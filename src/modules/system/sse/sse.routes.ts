/**
 * SSE Routes
 * Server-Sent Events
 */
import { Router } from 'express';
import * as sseController from './sse.controller';
import adminAuthMiddleware from '../../../shared/infra/http/middlewares/admin-auth.middleware';
import logger from '../../../shared/container/logger';
import sseAuthMiddleware from './sse-auth.middleware';

const router = Router();

// Stream de notificações SSE (requer autenticação)
router.get('/stream', sseAuthMiddleware, sseController.streamNotificacoes);

// Estatísticas SSE (apenas admin)
router.get('/stats', sseAuthMiddleware, adminAuthMiddleware, sseController.getEstatisticas);

logger.info('[Routes SSE] Rotas de Server-Sent Events configuradas');

export default router;
