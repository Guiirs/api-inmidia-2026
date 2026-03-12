import { Request, Response, NextFunction } from 'express';
import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import config from '@config/config';
import logger from '@shared/container/logger';
import { IUserPayload } from '../../../../types/express.d';
import AppError from '@shared/container/AppError';

/**
 * Middleware to authenticate JWT tokens
 */
const authenticateToken = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      logger.warn('[AuthMiddleware] Token de autenticacao ausente na requisicao.');
      throw new AppError('Token nao fornecido.', 401);
    }

    let decoded: IUserPayload;
    try {
      decoded = jwt.verify(token, config.jwtSecret) as IUserPayload;
    } catch (error: unknown) {
      if (error instanceof TokenExpiredError) {
        logger.warn('[AuthMiddleware] Token expirado.');
        throw new AppError('Seu token expirou. Faça login novamente.', 401);
      }

      if (error instanceof JsonWebTokenError) {
        logger.warn(`[AuthMiddleware] Token invalido: ${error.message}`);
        throw new AppError('Token invalido ou expirado.', 401);
      }

      logger.error('[AuthMiddleware] Erro inesperado ao validar token.');
      throw new AppError('Erro ao validar sessao.', 401);
    }

    if (!decoded || !decoded.id || !decoded.email) {
      logger.error(
        `[AuthMiddleware] Payload do token incompleto para utilizador ID: ${decoded?.id || 'N/A'}.`
      );
      throw new AppError('Token invalido (payload incompleto).', 401);
    }

    req.user = decoded;

    logger.debug(
      `[AuthMiddleware] Token validado para utilizador: ${req.user.email} (ID: ${req.user.id})`
    );

    next();
  } catch (error) {
    next(error);
  }
};

export default authenticateToken;