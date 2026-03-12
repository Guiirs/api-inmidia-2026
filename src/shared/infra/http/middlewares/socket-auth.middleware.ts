import jwt from 'jsonwebtoken';
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
 * Middleware de autenticaÃ§Ã£o para conexÃµes Socket.IO
 * Valida JWT token enviado pelo cliente via handshake.auth (sem query string).
 */
const socketAuthMiddleware = (socket: AuthSocket, next: (err?: Error) => void): void => {
  try {
    // Extrai token do handshake (somente auth)
    const token = socket.handshake.auth?.token;

    if (!token) {
      logger.warn('[SocketAuth] Tentativa de conexÃ£o sem token');
      return next(new Error('Authentication error: Token nÃ£o fornecido'));
    }

    // Valida o token JWT
    const decoded = jwt.verify(String(token), process.env.JWT_SECRET!) as DecodedToken;

    // Adiciona dados do usuÃ¡rio ao socket
    socket.user = {
      id: decoded.id,
      empresaId: decoded.empresaId,
      role: decoded.role,
      username: decoded.username,
    };

    logger.info(`[SocketAuth] UsuÃ¡rio autenticado: ${decoded.username} (${decoded.id})`);
    next();
  } catch (error: any) {
    logger.error(`[SocketAuth] Erro de autenticaÃ§Ã£o: ${error.message}`);
    next(new Error('Authentication error: Token invÃ¡lido'));
  }
};

export default socketAuthMiddleware;
