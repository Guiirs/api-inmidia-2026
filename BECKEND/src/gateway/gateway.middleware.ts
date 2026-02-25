/**
 * API Gateway Middleware
 * 
 * Middleware que implementa funcionalidades de gateway:
 * - Roteamento para módulos/serviços
 * - Circuit breaker
 * - Rate limiting por rota
 * - Logging centralizado
 * - Timeout handling
 */

import { Request, Response, NextFunction } from 'express';
import { gatewayConfig, findRoute } from './gateway.config';
import logger from '../shared/container/logger';

// Circuit breaker state por módulo
interface CircuitState {
  failures: number;
  lastFailure: Date | null;
  isOpen: boolean;
}

const circuitStates = new Map<string, CircuitState>();

/**
 * Inicializa estado do circuit breaker para um módulo
 */
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

/**
 * Registra falha no circuit breaker
 */
function recordFailure(module: string): void {
  const state = getCircuitState(module);
  state.failures++;
  state.lastFailure = new Date();

  if (state.failures >= gatewayConfig.circuitBreaker.threshold) {
    state.isOpen = true;
    logger.warn(`[Gateway] Circuit breaker aberto para módulo: ${module}`);
    
    // Limpa timeout anterior se existir
    if ((state as any).timeoutId) {
      clearTimeout((state as any).timeoutId);
    }
    
    // Tenta fechar o circuito após o timeout
    (state as any).timeoutId = setTimeout(() => {
      state.failures = 0;
      state.isOpen = false;
      logger.info(`[Gateway] Circuit breaker fechado para módulo: ${module}`);
    }, gatewayConfig.circuitBreaker.timeout);
  }
}

/**
 * Registra sucesso no circuit breaker
 */
function recordSuccess(module: string): void {
  const state = getCircuitState(module);
  state.failures = Math.max(0, state.failures - 1); // Reduz falhas gradualmente
}

/**
 * Middleware de gateway
 */
export function gatewayMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const route = findRoute(req.path);

  // Se não encontrou rota no gateway, passa adiante (comportamento normal)
  if (!route) {
    return next();
  }

  // Verifica circuit breaker
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

  // Log de entrada (apenas em debug)
  if (process.env.LOG_GATEWAY === 'true') {
    logger.info(`[Gateway] ${req.method} ${req.path} → ${route.module}`);
  }

  // Adiciona informações de roteamento ao request
  (req as any).gatewayRoute = route;

  // Intercepta a resposta para logging e métricas
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - startTime;
    
    if (res.statusCode >= 500) {
      recordFailure(route.module);
      logger.error(`[Gateway] ${req.method} ${req.path} → ${route.module} - ${res.statusCode} (${duration}ms) - FALHA`);
    } else if (res.statusCode >= 400) {
      recordSuccess(route.module);
      logger.warn(`[Gateway] ${req.method} ${req.path} → ${route.module} - ${res.statusCode} (${duration}ms)`);
    } else {
      recordSuccess(route.module);
      // Log sucesso apenas em debug
      if (process.env.LOG_GATEWAY === 'true') {
        logger.info(`[Gateway] ${req.method} ${req.path} → ${route.module} - ${res.statusCode} (${duration}ms)`);
      }
    }

    // Adiciona headers de telemetria
    res.setHeader('X-Gateway-Module', route.module);
    res.setHeader('X-Response-Time', `${duration}ms`);

    return originalSend.call(this, data);
  };

  // Timeout handling
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      recordFailure(route.module);
      logger.error(`[Gateway] Timeout na requisição para ${route.module}`);
      res.status(504).json({
        error: 'Gateway Timeout',
        message: `O módulo ${route.module} não respondeu a tempo`,
        module: route.module,
      });
    }
  }, gatewayConfig.defaultTimeout);

  // Limpa o timeout quando a resposta for enviada
  res.on('finish', () => {
    clearTimeout(timeout);
  });

  next();
}

/**
 * Middleware para obter estatísticas do gateway
 */
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
      hasRateLimit: !!r.rateLimit,
    })),
  });
}

/**
 * Middleware para health check do gateway
 */
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
