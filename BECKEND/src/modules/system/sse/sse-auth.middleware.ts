import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '@config/config';
import logger from '@shared/container/logger';
import AppError from '@shared/container/AppError';

/**
 * Autenticacao para SSE.
 * Suporta Authorization Bearer e token via query (?token=...)
 * porque EventSource nativo nao envia headers customizados.
 */
const sseAuthMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers['authorization'];
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : undefined;

    const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
    const token = bearerToken || queryToken;

    if (!token) {
      logger.warn('[SSEAuthMiddleware] Token ausente.');
      throw new AppError('Token não fornecido.', 401);
    }

    const decoded = jwt.verify(token, config.jwtSecret) as any;

    if (!decoded || !decoded.id || !decoded.email) {
      logger.warn('[SSEAuthMiddleware] Payload JWT inválido.');
      throw new AppError('Token inválido (payload incompleto).', 403);
    }

    req.user = decoded;
    next();
  } catch (error: any) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    logger.warn(`[SSEAuthMiddleware] Falha ao verificar token: ${error.message}`);
    next(new AppError('Token inválido ou expirado.', 403));
  }
};

export default sseAuthMiddleware;
