/**
 * WhatsApp Routes
 * Rotas para gerenciar integracao WhatsApp
 */

import { Router } from 'express';
import { z } from 'zod';
import * as whatsappController from './whatsapp.controller';
import authMiddleware from '../../shared/infra/http/middlewares/auth.middleware';
import adminAuthMiddleware from '../../shared/infra/http/middlewares/admin-auth.middleware';
import logger from '../../shared/container/logger';
import { validate } from '@shared/infra/http/middlewares/validate.middleware';

const router = Router();

const sendMessageSchema = z.object({
  body: z.object({
    mensagem: z.string().min(1, 'Mensagem e obrigatoria').max(4096, 'Mensagem muito longa (max 4096 caracteres)'),
  }),
});

router.use(authMiddleware);
router.use(adminAuthMiddleware);

router.get('/status', whatsappController.getStatus);
router.get('/qr', whatsappController.getQrCode);
router.post('/enviar-relatorio', whatsappController.enviarRelatorio);
router.post('/enviar-mensagem', validate(sendMessageSchema), whatsappController.enviarMensagem);
router.post('/reconectar', whatsappController.reconectar);
router.get('/grupos', whatsappController.listarGrupos);

logger.info('[Routes WhatsApp] Rotas de WhatsApp configuradas');

export default router;
