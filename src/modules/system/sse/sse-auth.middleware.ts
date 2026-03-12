import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '@config/config';
import logger from '@shared/container/logger';
import AppError from '@shared/container/AppError';

/**
 * Autenticacao para SSE.
 * Utiliza exclusivamente Authorization Bearer por header para evitar vazamento em query string.
 */
const sseAuthMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers['authorization'];
    const token =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : undefined;

    if (!token) {
      logger.warn('[SSEAuthMiddleware] Token ausente.');
      throw new AppError('Token nÃ£o fornecido.', 401);
    }

    const decoded = jwt.verify(token, config.jwtSecret) as any;

    if (!decoded || !decoded.id || !decoded.email) {
      logger.warn('[SSEAuthMiddleware] Payload JWT invÃ¡lido.');
      throw new AppError('Token invÃ¡lido (payload incompleto).', 403);
    }

    req.user = decoded;
    next();
  } catch (error: any) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    logger.warn(`[SSEAuthMiddleware] Falha ao verificar token: ${error.message}`);
    next(new AppError('Token invÃ¡lido ou expirado.', 403));
  }
};

export default sseAuthMiddleware;
