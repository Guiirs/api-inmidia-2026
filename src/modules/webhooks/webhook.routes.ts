/**
 * Webhook Routes
 * Rotas de webhooks
 */
import { Router } from 'express';
import { z } from 'zod';
import * as webhookController from './webhook.controller';
import authMiddleware from '../../shared/infra/http/middlewares/auth.middleware';
import adminAuthMiddleware from '../../shared/infra/http/middlewares/admin-auth.middleware';
import logger from '../../shared/container/logger';
import { validate } from '@shared/infra/http/middlewares/validate.middleware';

const router = Router();

const eventosValidos = [
  'placa_disponivel', 'placa_alugada', 'contrato_criado',
  'contrato_expirando', 'contrato_expirado', 'pi_criada',
  'pi_aprovada', 'cliente_novo', 'aluguel_criado', 'aluguel_cancelado'
] as const;

const webhookIdRegex = /^[0-9a-fA-F]{24}$/;

const webhookIdParamsSchema = z.object({
  params: z.object({
    webhookId: z.string().regex(webhookIdRegex, 'ID do webhook invalido'),
  }),
});

const createWebhookSchema = z.object({
  body: z.object({
    nome: z.string().trim().min(1, 'Nome e obrigatorio').max(100, 'Nome nao pode exceder 100 caracteres'),
    url: z.string().trim().url('URL invalida').refine((url) => /^https?:\/\//.test(url), 'URL deve comecar com http:// ou https://'),
    eventos: z.array(z.enum(eventosValidos)).min(1, 'Pelo menos um evento deve ser selecionado'),
    retry_config: z.object({
      max_tentativas: z.number().int().min(1).max(5).optional(),
      timeout_ms: z.number().int().min(1000).max(30000).optional(),
    }).optional(),
  }),
});

const updateWebhookSchema = z.object({
  params: z.object({
    webhookId: z.string().regex(webhookIdRegex, 'ID do webhook invalido'),
  }),
  body: z.object({
    nome: z.string().trim().max(100, 'Nome nao pode exceder 100 caracteres').optional(),
    url: z.string().trim().url('URL invalida').refine((url) => /^https?:\/\//.test(url), 'URL deve comecar com http:// ou https://').optional(),
    eventos: z.array(z.enum(eventosValidos)).min(1, 'Pelo menos um evento deve ser selecionado').optional(),
    ativo: z.boolean().optional(),
  }),
});

router.use(authMiddleware);
router.use(adminAuthMiddleware);

router.get('/', webhookController.listarWebhooks);
router.post('/', validate(createWebhookSchema), webhookController.criarWebhook);
router.get('/:webhookId', validate(webhookIdParamsSchema), webhookController.buscarWebhook);
router.put('/:webhookId', validate(updateWebhookSchema), webhookController.atualizarWebhook);
router.delete('/:webhookId', validate(webhookIdParamsSchema), webhookController.removerWebhook);
router.post('/:webhookId/regenerar-secret', validate(webhookIdParamsSchema), webhookController.regenerarSecret);
router.post('/:webhookId/testar', validate(webhookIdParamsSchema), webhookController.testarWebhook);

logger.info('[Routes Webhook] Rotas de webhooks configuradas');

export default router;
