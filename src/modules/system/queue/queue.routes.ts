/**
 * Queue Routes
 * Rotas de filas
 */
import { Router } from 'express';
import { z } from 'zod';
import * as queueController from './queue.controller';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { validate } from '@shared/infra/http/middlewares/validate.middleware';
import logger from '@shared/container/logger';

const router = Router();

logger.info('[Routes Queue] Definindo rotas de Queue...');

router.use(authenticateToken);

const mongoIdRegex = /^[0-9a-fA-F]{24}$/;
const jobIdParamSchema = z.object({
  params: z.object({
    jobId: z.string().min(1, 'Job ID e obrigatorio.'),
  }),
});

const entityIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(mongoIdRegex, 'O ID fornecido e invalido.'),
  }),
});

router.post('/contratos/:id/generate-pdf', validate(entityIdParamSchema), queueController.generateContratoPDF);
router.post('/pis/:id/generate-pdf', validate(entityIdParamSchema), queueController.generatePIPDF);
router.get('/jobs/:jobId', validate(jobIdParamSchema), queueController.getJobStatus);
router.get('/jobs', queueController.getJobs);
router.get('/jobs/:jobId/download', validate(jobIdParamSchema), queueController.downloadJobResult);

logger.info('[Routes Queue] Rotas de Queue definidas com sucesso.');

export default router;
