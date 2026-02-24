import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

// Config
import logger from '@shared/container/logger';
import config from '@config/config';
import connectDB from '@shared/infra/db/dbMongo';

// Services and Middlewares (imported for Socket.IO and other features)
import socketAuthMiddleware from './middlewares/socket-auth.middleware';
import notificationService from '@shared/container/notification.service';
import whatsappService from '@modules/whatsapp/whatsapp.service';
import QueueService from '@shared/container/queue.service';
// import scheduleJobs from '@scripts/updateStatusJob'; // Disabled - script removed

// Import the Express app
import app from './app';

// Load environment variables
dotenv.config();

// --- Server Initialization ---
const PORT = config.port;

let server: http.Server | undefined;
let io: SocketIOServer | undefined;

if (process.env.NODE_ENV !== 'test') {
  server = http.createServer(app);

  // Socket.IO Configuration
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Socket.IO authentication middleware
  io.use(socketAuthMiddleware);

  // Connection management
  io.on('connection', (socket: any) => {
    const { id: userId, empresaId, role, username } = socket.user;

    logger.info(`[Socket.IO] 🔌 Client connected: ${username} (${socket.id})`);

    // Join user and company rooms
    socket.join(`user_${userId}`);
    socket.join(`empresa_${empresaId}`);

    if (role === 'admin') {
      socket.join('admins');
      logger.debug(`[Socket.IO] Admin ${username} joined 'admins' room`);
    }

    // Ping/pong test event
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // Disconnect
    socket.on('disconnect', (reason: string) => {
      logger.info(`[Socket.IO] 🔌 Client disconnected: ${username} (${socket.id}) - Reason: ${reason}`);
    });

    // Error
    socket.on('error', (error: Error) => {
      logger.error(`[Socket.IO] ❌ Socket error ${socket.id}: ${error.message}`);
    });
  });

  // Initialize notification service
  notificationService.initialize(io);
  logger.info('[Socket.IO] ✅ Socket.IO configured and ready');

  // Initialize WhatsApp service (if enabled)
  if (process.env.WHATSAPP_ENABLED === 'true') {
    whatsappService.initialize().catch((err: Error) => {
      logger.error(`[WhatsApp] Error initializing: ${err.message}`);
      logger.warn('[WhatsApp] Continuing without WhatsApp...');
    });
  }

  // Initialize Queue Service (BullMQ)
  logger.info('[QueueService] Initializing PDF generation queue...');
  // QueueService is initialized automatically via singleton pattern

  // Connect to database before starting server
  connectDB()
    .then(async () => {
      logger.info('[DB] ✅ Conexão estabelecida com sucesso');

      // Start server
      server!.listen(PORT, () => {
        logger.info(`🚀 Server running in ${config.nodeEnv} mode on port ${PORT}`);
        logger.info(`📚 API Documentation: http://localhost:${PORT}/api/v1/docs`);
        logger.info(`🔌 Socket.IO: ws://localhost:${PORT}`);

        // Schedule cron jobs (disabled - scripts folder removed)
        // scheduleJobs();
        // logger.info('[Cron] ⏰ Jobs scheduled');
      });
    })
    .catch((err) => {
      logger.error(`[DB] ❌ Erro ao conectar: ${err.message}`);
      process.exit(1);
    });
} else {
  logger.info('[Server] Test mode detected - HTTP server not started');
}

// --- Process Error Handlers ---

// Uncaught Exception Handler
process.on('uncaughtException', (err: Error) => {
  logger.error('💥 UNCAUGHT EXCEPTION! Shutting down...');
  logger.error(`Name: ${err.name}`);
  logger.error(`Message: ${err.message}`);
  logger.error(`Stack: ${err.stack}`);
  process.exit(1);
});

// Unhandled Rejection Handler
process.on('unhandledRejection', (reason: any, _promise: Promise<any>) => {
  // Ignora erros do Puppeteer/WhatsApp relacionados a "Session closed"
  const errorMessage = reason?.message || String(reason);
  
  if (errorMessage.includes('Session closed') || 
      errorMessage.includes('Protocol error') ||
      errorMessage.includes('Target closed')) {
    logger.warn('⚠️ [WhatsApp/Puppeteer] Erro de sessão ignorado (não crítico)');
    logger.warn(`Detalhes: ${errorMessage}`);
    return; // Não encerra o servidor
  }

  // Para outros erros, mantém comportamento original
  logger.error('💥 UNHANDLED REJECTION! Shutting down...');
  logger.error(`Reason: ${errorMessage}`);
  
  if (reason?.stack) {
    logger.error(`Stack: ${reason.stack}`);
  }
  
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('👋 SIGTERM received. Shutting down gracefully...');

  try {
    await QueueService.close();
    logger.info('[QueueService] Closed successfully');
  } catch (err: any) {
    logger.error(`[QueueService] Error closing: ${err.message}`);
  }

  if (server) {
    server.close(() => {
      logger.info('💤 Process terminated');
    });
  }
});

// Graceful shutdown for SIGINT (Ctrl+C)
process.on('SIGINT', async () => {
  logger.info('👋 SIGINT received. Shutting down gracefully...');

  try {
    // Close server first to stop accepting new requests
    if (server) {
      await new Promise((resolve) => {
        server!.close((err) => {
          if (err) {
            logger.error(`[Server] Error closing server: ${err.message}`);
          } else {
            logger.info('[Server] HTTP server closed');
          }
          resolve(void 0);
        });
      });
    }

    // Close Socket.IO connections gracefully
    if (io) {
      await new Promise((resolve) => {
        io!.close((err) => {
          if (err) {
            logger.error(`[Socket.IO] Error closing: ${err.message}`);
          } else {
            logger.info('[Socket.IO] Closed successfully');
          }
          resolve(void 0);
        });
      });
    }

    // Close WhatsApp service
    if (process.env.WHATSAPP_ENABLED === 'true') {
      try {
        logger.info('[WhatsApp] Iniciando cleanup...');
        await whatsappService.cleanup();
        logger.info('[WhatsApp] ✅ Cleanup concluído');
      } catch (err: any) {
        logger.error(`[WhatsApp] Erro durante shutdown: ${err.message}`);
      }
    }

    // Close Queue Service and wait for active jobs to finish
    try {
      await QueueService.close();
      logger.info('[QueueService] Closed successfully');
    } catch (err: any) {
      logger.error(`[QueueService] Error closing: ${err.message}`);
    }

    logger.info('💤 All services closed. Process terminated gracefully');
    process.exit(0);
  } catch (err: any) {
    logger.error(`[Shutdown] Error during graceful shutdown: ${err.message}`);
    process.exit(1);
  }
});

// Export app for testing
export default app;
