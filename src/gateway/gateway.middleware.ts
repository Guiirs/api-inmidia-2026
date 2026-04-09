/**
 * API Gateway Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { gatewayConfig, findRoute, ServiceRoute } from './gateway.config';
import logger from '../shared/container/logger';
import {
  createRouteRateLimiter,
} from '../shared/infra/http/middlewares/rate-limit.middleware';
import apiKeyAuthMiddleware from '../shared/infra/http/middlewares/api-key-auth.middleware';

interface CircuitState {
  failures: number;
  lastFailure: Date | null;
  isOpen: boolean;
}

const circuitStates = new Map<string, CircuitState>();
const routeLimiters = new Map<string, ReturnType<typeof createRouteRateLimiter>>();

function buildRateLimiterKey(routePath: string, windowMs: number, max: number): string {
  return `${routePath}#${windowMs}#${max}`;
}

function preloadRouteLimiters(): void {
  gatewayConfig.routes.forEach((route) => {
    if (!route.rateLimit) {
      return;
    }

    const limiterKey = buildRateLimiterKey(route.path, route.rateLimit.windowMs, route.rateLimit.max);
    if (!routeLimiters.has(limiterKey)) {
      routeLimiters.set(
        limiterKey,
        createRouteRateLimiter(route.path, route.rateLimit.max, route.rateLimit.windowMs)
      );
    }
  });
}

preloadRouteLimiters();

function getCircuitState(module: string): CircuitState {
  if (!circuitStates.has(module)) {
    circuitStates.set(module, {
      failures: 0,
      lastFailure: null,
      isOpen: false,
    });
  }
  return circuitStates.get(module)!;
}

function recordFailure(module: string): void {
  const state = getCircuitState(module);
  state.failures++;
  state.lastFailure = new Date();

  if (state.failures >= gatewayConfig.circuitBreaker.threshold) {
    state.isOpen = true;
    logger.warn(`[Gateway] Circuit breaker aberto para módulo: ${module}`);

    if ((state as any).timeoutId) {
      clearTimeout((state as any).timeoutId);
    }

    (state as any).timeoutId = setTimeout(() => {
      state.failures = 0;
      state.isOpen = false;
      logger.info(`[Gateway] Circuit breaker fechado para módulo: ${module}`);
    }, gatewayConfig.circuitBreaker.timeout);
  }
}

function recordSuccess(module: string): void {
  const state = getCircuitState(module);
  state.failures = Math.max(0, state.failures - 1);
}

function getRouteRateLimiter(routePath: string, windowMs: number, max: number) {
  const key = buildRateLimiterKey(routePath, windowMs, max);
  const limiter = routeLimiters.get(key);

  if (!limiter) {
    throw new Error(`[Gateway] Rate limiter não inicializado para rota ${routePath}`);
  }

  return limiter;
}

function hasAuthContext(req: Request): boolean {
  return Boolean((req as any).user?.id || (req as any).user?.empresaId);
}

function hasApiKeyContext(req: Request): boolean {
  return Boolean((req as any).empresa?._id);
}

function hasRequiredRole(route: ServiceRoute, req: Request): boolean {
  if (!route.requiredRoles || route.requiredRoles.length === 0) {
    return true;
  }
  const role = (req as any).user?.role;
  if (!role) return false;
  return route.requiredRoles.includes(role);
}

function verifyApiKeyAuth(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    // NextFunction may be invoked with any value (string, object, etc.),
    // so keep the callback parameter loose to satisfy its signature.
    apiKeyAuthMiddleware(req as any, res, (error?: any) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export function gatewayMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const route = findRoute(req.path);

  if (!route) {
    return next();
  }

  const circuitState = getCircuitState(route.module);
  if (circuitState.isOpen) {
    logger.error(`[Gateway] Requisição bloqueada - Circuit breaker aberto para ${route.module}`);
    res.status(503).json({
      error: 'Service Unavailable',
      message: `O módulo ${route.module} está temporariamente indisponível`,
      module: route.module,
      retryAfter: Math.ceil(gatewayConfig.circuitBreaker.timeout / 1000),
    });
    return;
  }

  const runWithGatewayFlow = () => {
    if (
      route.requiredRoles &&
      route.requiredRoles.length > 0 &&
      (route.requiresAuth ? hasAuthContext(req) : true) &&
      !hasRequiredRole(route, req)
    ) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Permissão insuficiente para a rota ${req.path}`,
        module: route.module,
      });
      return;
    }

    if (process.env.LOG_GATEWAY === 'true') {
      logger.info(`[Gateway] ${req.method} ${req.path} -> ${route.module}`);
    }

    (req as any).gatewayRoute = route;

    const originalSend = res.send;
    res.send = function (data: any) {
      const duration = Date.now() - startTime;

      if (res.statusCode >= 500) {
        recordFailure(route.module);
        logger.error(
          `[Gateway] ${req.method} ${req.path} -> ${route.module} - ${res.statusCode} (${duration}ms) - FALHA`
        );
      } else if (res.statusCode >= 400) {
        recordSuccess(route.module);
        logger.warn(
          `[Gateway] ${req.method} ${req.path} -> ${route.module} - ${res.statusCode} (${duration}ms)`
        );
      } else {
        recordSuccess(route.module);
        if (process.env.LOG_GATEWAY === 'true') {
          logger.info(
            `[Gateway] ${req.method} ${req.path} -> ${route.module} - ${res.statusCode} (${duration}ms)`
          );
        }
      }

      res.setHeader('X-Gateway-Module', route.module);
      res.setHeader('X-Response-Time', `${duration}ms`);

      return originalSend.call(this, data);
    };

    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        recordFailure(route.module);
        logger.error(`[Gateway] Timeout na Requisição para ${route.module}`);
        res.status(504).json({
          error: 'Gateway Timeout',
          message: `O módulo ${route.module} não respondeu a tempo`,
          module: route.module,
        });
      }
    }, gatewayConfig.defaultTimeout);

    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };

  const runAuthzAndRoute = () => {
    if (route.requiresApiKey && !hasApiKeyContext(req)) {
      res.status(401).json({
        error: 'Unauthorized',
        message: `API key obrigatória para a rota ${req.path}`,
        module: route.module,
      });
      return;
    }

    if (
      route.requiredRoles &&
      route.requiredRoles.length > 0 &&
      (route.requiresAuth ? hasAuthContext(req) : true) &&
      !hasRequiredRole(route, req)
    ) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Permissão insuficiente para a rota ${req.path}`,
        module: route.module,
      });
      return;
    }

    if (route.rateLimit) {
      const limiter = getRouteRateLimiter(
        route.path,
        route.rateLimit.windowMs,
        route.rateLimit.max
      );
      limiter(req, res, () => runWithGatewayFlow());
      return;
    }

    runWithGatewayFlow();
  };

  if (route.requiresApiKey && hasApiKeyContext(req)) {
    runAuthzAndRoute();
    return;
  }

  if (route.requiresApiKey) {
    verifyApiKeyAuth(req, res)
      .then(() => {
        runAuthzAndRoute();
      })
      .catch((error) => {
        next(error);
      });
    return;
  }

  runAuthzAndRoute();
}

export function getGatewayStats(_req: Request, res: Response): void {
  const stats = Array.from(circuitStates.entries()).map(([module, state]) => ({
    module,
    status: state.isOpen ? 'open' : 'closed',
    failures: state.failures,
    lastFailure: state.lastFailure,
  }));

  res.json({
    circuitBreakers: stats,
    config: {
      defaultTimeout: gatewayConfig.defaultTimeout,
      circuitBreaker: gatewayConfig.circuitBreaker,
    },
    routes: gatewayConfig.routes.map(r => ({
      path: r.path,
      module: r.module,
      requiresAuth: r.requiresAuth,
      requiresApiKey: r.requiresApiKey,
      requiredRoles: r.requiredRoles,
      hasRateLimit: !!r.rateLimit,
      rateLimit: r.rateLimit,
    })),
  });
}

export function gatewayHealthCheck(_req: Request, res: Response): void {
  const openCircuits = Array.from(circuitStates.entries())
    .filter(([, state]) => state.isOpen)
    .map(([module]) => module);

  const isHealthy = openCircuits.length === 0;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    openCircuits,
    timestamp: new Date().toISOString(),
  });
}
