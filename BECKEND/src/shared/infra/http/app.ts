import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import dotenv from 'dotenv';

// Config
import swaggerConfig from '@config/swaggerConfig';
import logger from '@shared/container/logger';
import config from '@config/config';

// Gateway
import { bootstrapGateway, getGatewayInfo } from '@gateway/index';

// Middlewares
import { errorHandler, sanitize, globalRateLimiter } from './middlewares';
import { metricsMiddleware, getMetrics } from '@shared/infra/monitoring/metrics';

// Utils
import AppError from '@shared/container/AppError';

// Load environment variables
dotenv.config();

// Initialize Express app
const app: Application = express();

// --- Essential Middlewares ---
app.use(helmet()); // Security headers

// Global rate limiting (2000 req/min per IP)
app.use('/api', globalRateLimiter);

// Metrics middleware (must be after rate limiting but before routes)
app.use(metricsMiddleware);

// CORS configuration
app.use(
  cors({
    origin: config.corsOrigin && config.corsOrigin !== '*' ? config.corsOrigin : 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sanitization middleware (NoSQL injection protection)
app.use(sanitize);

// Static files
app.use(express.static('public'));

// Health check endpoint (no rate limit)
app.get('/api/v1/status', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint (protected by basic auth)
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    // Basic authentication for Prometheus scraping
    const authHeader = req.headers.authorization;
    const expectedAuth = `Basic ${Buffer.from(`${process.env.METRICS_USER || 'prometheus'}:${process.env.METRICS_PASSWORD || 'password'}`).toString('base64')}`;

    if (!authHeader || authHeader !== expectedAuth) {
      res.set('WWW-Authenticate', 'Basic realm="Metrics"');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const metricsData = await getMetrics();
    res.set('Content-Type', 'text/plain; charset=utf-8');
    return res.send(metricsData);
  } catch (error: any) {
    logger.error('[Metrics] Error serving metrics:', error.message);
    return res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

// Logs simplificados de endpoints
if (process.env.LOG_GATEWAY === 'true') {
  logger.info('[Routes] 📊 Health: /status, /health | Metrics: /metrics | Docs: /api/v1/docs');
}

// API Documentation (Swagger)
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerConfig));

// --- API Gateway Bootstrap ---
// All API routes are now registered through the Gateway Module Registry
// This provides centralized routing, circuit breaker, rate limiting, and monitoring
bootstrapGateway(app);

// Gateway Info Endpoint
app.get('/api/v1/gateway/info', (_req: Request, res: Response) => {
  const info = getGatewayInfo();
  return res.json(info);
});

// API Root Info Endpoint
app.get('/api/v1', (_req: Request, res: Response) => {
  res.status(200).json({
    message: 'API v1 - Backstage System',
    version: '1.0.0',
    status: 'online',
    timestamp: new Date().toISOString(),
    documentation: '/api/v1/docs',
    gateway: '/api/v1/gateway/info',
  });
});


// --- Error Handlers ---

// 404 Handler
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(`Rota não encontrada: ${req.originalUrl}`, 404));
});

// Global Error Handler (must be last middleware)
app.use(errorHandler);

export default app;
