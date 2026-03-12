import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '@config/config';
import logger from '@shared/container/logger';
import AppError from '@shared/container/AppError';

/**
 * Autenticacao para SSE.
 * EventSource não permite cabeçalhos customizados, por isso o frontend envia o
 * token na querystring. O middleware ainda prioriza o header quando presente
 * (Bearer) mas cairá no parâmetro `?token=` como fallback compatível.
 */
const sseAuthMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers['authorization'];
    const queryToken =
      typeof req.query?.token === 'string' ? req.query.token.trim() : undefined;
    const token =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : queryToken;

    if (!token) {
      logger.warn('[SSEAuthMiddleware] Token ausente.');
      throw new AppError('Token nÃ£o fornecido.', 401);
    }

    const decoded = jwt.verify(token, config.jwtSecret, { clockTolerance: 45 }) as any;

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
