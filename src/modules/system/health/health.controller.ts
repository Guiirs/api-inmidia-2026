/**
 * Health Controller
 * Endpoints de health check
 */
// src/modules/system/health/health.controller.ts
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import logger from '../../../shared/container/logger';
import cacheService from '../../../shared/container/cache.service';
import config from '../../../config/config';
import fs from 'fs';
import path from 'path';

/**
 * Health Check Detalhado
 * Verifica conexÃµes com MongoDB, Redis e outros serviÃ§os externos
 * 
 * GET /api/v1/status
 * 
 * Retorna:
 * - 200: Todos os serviÃ§os saudÃ¡veis
 * - 503: Um ou mais serviÃ§os indisponÃ­veis
 */
export async function healthCheck(_req: Request, res: Response, _next: NextFunction): Promise<void> {
  const startTime = Date.now();
  const checks: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {}
  };

  let isHealthy = true;

  // 1. Check MongoDB
  try {
    const mongoState = mongoose.connection.readyState;
    const stateMap: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    checks.services.mongodb = {
      status: mongoState === 1 ? 'healthy' : 'unhealthy',
      state: stateMap[mongoState],
      message: mongoState === 1 ? 'Connected' : `State: ${stateMap[mongoState]}`
    };

    // Tenta ping no MongoDB
    if (mongoState === 1) {
      const db = mongoose.connection.db;
      if (db) {
        await db.admin().ping();
        checks.services.mongodb.ping = 'success';
      } else {
        checks.services.mongodb.ping = 'unavailable';
        isHealthy = false;
      }
    }

    if (mongoState !== 1) {
      isHealthy = false;
    }

  } catch (error: any) {
    logger.error('[HealthCheck] Erro ao verificar MongoDB:', error.message);
    checks.services.mongodb = {
      status: 'unhealthy',
      error: error.message
    };
    isHealthy = false;
  }

  // 2. Check Redis (se configurado)
  try {
    const redisAvailable = cacheService.isAvailable();
    
    if (!config.redisEnabled) {
      checks.services.redis = {
        status: 'disabled',
        message: 'Disabled by REDIS_ENABLED'
      };
    } else if (process.env.REDIS_HOST || process.env.REDIS_URL) {
      // Redis estÃ¡ configurado, deve estar disponÃ­vel
      checks.services.redis = {
        status: redisAvailable ? 'healthy' : 'unhealthy',
        message: redisAvailable ? 'Connected' : 'Connection failed'
      };

      if (!redisAvailable) {
        isHealthy = false;
      }
    } else {
      // Redis nÃ£o configurado (nÃ£o crÃ­tico em dev)
      checks.services.redis = {
        status: 'disabled',
        message: 'Not configured (using database fallback)'
      };
    }
  } catch (error: any) {
    logger.error('[HealthCheck] Erro ao verificar Redis:', error.message);
    checks.services.redis = {
      status: 'unhealthy',
      error: error.message
    };
    // Redis nÃ£o Ã© crÃ­tico em dev
    if (process.env.NODE_ENV === 'production') {
      isHealthy = false;
    }
  }

  // 3. Check File System (uploads directory)
  try {
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
    
    const accessible = fs.existsSync(uploadsDir);
    checks.services.filesystem = {
      status: accessible ? 'healthy' : 'unhealthy',
      uploads_dir: uploadsDir,
      writable: accessible ? true : false
    };

    if (!accessible) {
      isHealthy = false;
    }
  } catch (error: any) {
    logger.error('[HealthCheck] Erro ao verificar File System:', error.message);
    checks.services.filesystem = {
      status: 'unhealthy',
      error: error.message
    };
    isHealthy = false;
  }

  // 4. Memory usage
  const memUsage = process.memoryUsage();
  checks.memory = {
    rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(memUsage.external / 1024 / 1024)} MB`
  };

  // 5. Response time
  checks.responseTime = `${Date.now() - startTime}ms`;

  // Define status geral
  checks.status = isHealthy ? 'healthy' : 'unhealthy';

  // Retorna cÃ³digo apropriado
  const statusCode = isHealthy ? 200 : 503;

  if (!isHealthy) {
    logger.warn('[HealthCheck] Sistema com problemas:', checks);
  }

  res.status(statusCode).json(checks);
}

/**
 * Readiness Check
 * Verifica se a aplicaÃ§Ã£o estÃ¡ pronta para receber trÃ¡fego
 * 
 * GET /api/v1/ready
 */
export async function readinessCheck(_req: Request, res: Response, _next: NextFunction): Promise<void> {
  try {
    // Verifica se MongoDB estÃ¡ conectado
    if (mongoose.connection.readyState !== 1) {
      res.status(503).json({
        ready: false,
        message: 'Database not ready'
      });
      return;
    }

    // AplicaÃ§Ã£o pronta
    res.status(200).json({
      ready: true,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('[ReadinessCheck] Erro:', error.message);
    res.status(503).json({
      ready: false,
      error: error.message
    });
  }
}

/**
 * Liveness Check
 * Verifica se a aplicaÃ§Ã£o estÃ¡ viva (nÃ£o travada)
 * 
 * GET /api/v1/live
 */
export function livenessCheck(_req: Request, res: Response, _next: NextFunction): void {
  // Se chegou aqui, o processo estÃ¡ vivo
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString()
  });
}

export default {
  healthCheck,
  readinessCheck,
  livenessCheck
};


