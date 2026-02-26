import { Socket, Server as SocketIOServer } from 'socket.io';

/**
 * Socket.IO authenticated user data
 */
export interface ISocketUser {
  id: string;
  empresaId: string;
  role: 'admin' | 'user' | 'manager';
  username: string;
  email: string;
}

/**
 * Extended Socket with user authentication
 */
export interface IAuthenticatedSocket extends Socket {
  user?: ISocketUser;
}

/**
 * Socket.IO server with typed sockets
 */
export type TypedSocketServer = SocketIOServer;
