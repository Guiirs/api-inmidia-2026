import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import logger from '@shared/container/logger';
import { Socket } from 'socket.io';

interface DecodedToken {
  id: string;
  empresaId: string;
  role: string;
  username: string;
}

interface AuthSocket extends Socket {
  user?: DecodedToken;
}

/**
 * Middleware de autenticacao para conexoes Socket.IO
 * Valida JWT token enviado pelo cliente via handshake.auth (sem query string).
 */
const socketAuthMiddleware = (socket: AuthSocket, next: (err?: Error) => void): void => {
  try {
    // Extrai token do handshake (somente auth)
    const token = socket.handshake.auth?.token;

    if (!token) {
      logger.warn('[SocketAuth] Tentativa de conexao sem token');
      return next(new Error('Authentication error: Token nao fornecido'));
    }

    // Valida o token JWT
    const decoded = (jwt.verify(String(token), process.env.JWT_SECRET!, {
      clockTolerance: 45,
    }) as unknown) as DecodedToken;

    // Adiciona dados do usuario ao socket
    socket.user = {
      id: decoded.id,
      empresaId: decoded.empresaId,
      role: decoded.role,
      username: decoded.username,
    };

    logger.info(`[SocketAuth] Usuario autenticado: ${decoded.username} (${decoded.id})`);
    next();
  } catch (error: unknown) {
    if (error instanceof TokenExpiredError) {
      logger.warn('[SocketAuth] Erro de autenticacao: token expirado');
      return next(new Error('Authentication error: Token expirado'));
    }

    if (error instanceof JsonWebTokenError) {
      logger.warn('[SocketAuth] Erro de autenticacao: token invalido');
      return next(new Error('Authentication error: Token invalido'));
    }

    logger.error('[SocketAuth] Erro de autenticacao: token invalido ou erro desconhecido');
    return next(new Error('Authentication error: Token invalido'));
  }
};

export default socketAuthMiddleware;
