/**
 * Queue Routes
 * Rotas de filas
 */
import { Router } from 'express';
import * as queueController from './queue.controller';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { param } from 'express-validator';
import { handleValidationErrors } from '@modules/auth/authValidator';
import logger from '@shared/container/logger';

const router = Router();

logger.info('[Routes Queue] Definindo rotas de Queue...');

// Aplica autenticação a todas as rotas
router.use(authenticateToken);

// Validações
const validateJobIdParam = [
    param('jobId').notEmpty().withMessage('Job ID é obrigatório.')
];

const validateEntityIdParam = [
    param('id').isMongoId().withMessage('O ID fornecido é inválido.')
];

// POST /api/v1/queue/contratos/:id/generate-pdf - Inicia geração de PDF de contrato via queue
router.post(
    '/contratos/:id/generate-pdf',
    validateEntityIdParam,
    handleValidationErrors,
    queueController.generateContratoPDF
);

// POST /api/v1/queue/pis/:id/generate-pdf - Inicia geração de PDF de PI via queue
router.post(
    '/pis/:id/generate-pdf',
    validateEntityIdParam,
    handleValidationErrors,
    queueController.generatePIPDF
);

// GET /api/v1/queue/jobs/:jobId - Busca status de um job específico
router.get(
    '/jobs/:jobId',
    validateJobIdParam,
    handleValidationErrors,
    queueController.getJobStatus
);

// GET /api/v1/queue/jobs - Lista jobs da empresa (com filtros)
router.get(
    '/jobs',
    queueController.getJobs
);

// GET /api/v1/queue/jobs/:jobId/download - Download do resultado do job
router.get(
    '/jobs/:jobId/download',
    validateJobIdParam,
    handleValidationErrors,
    queueController.downloadJobResult
);

logger.info('[Routes Queue] Rotas de Queue definidas com sucesso.');

export default router;