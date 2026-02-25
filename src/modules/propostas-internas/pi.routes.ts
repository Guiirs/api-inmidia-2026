/**
 * PI Routes
 * Rotas de propostas internas
 */
import { Router } from 'express';
import * as piController from './pi.controller';
import authenticateToken from '@middlewares/auth.middleware';
import { piValidationRules, validateIdParam, handleValidationErrors } from '@validators/piValidator';
import logger from '@shared/container/logger';

const router = Router();

logger.info('[Routes PI] Definindo rotas de Propostas Internas (PIs)...');

// Aplica autenticação a todas as rotas
router.use(authenticateToken);

// GET /api/v1/pis - Lista todas as PIs (com filtros)
router.get('/', piController.getAllPIs);

// POST /api/v1/pis - Cria uma nova PI
router.post(
    '/',
    piValidationRules,
    handleValidationErrors,
    piController.createPI
);

// GET /api/v1/pis/:id - Busca uma PI específica
router.get(
    '/:id',
    validateIdParam,
    handleValidationErrors,
    piController.getPIById
);

// PUT /api/v1/pis/:id - Atualiza uma PI
router.put(
    '/:id',
    validateIdParam,
    piValidationRules,
    handleValidationErrors,
    piController.updatePI
);

// DELETE /api/v1/pis/:id - Apaga uma PI
router.delete(
    '/:id',
    validateIdParam,
    handleValidationErrors,
    piController.deletePI
);

// GET /api/v1/pis/:id/download - Gera o PDF da PI
router.get(
    '/:id/download',
    validateIdParam,
    handleValidationErrors,
    piController.downloadPI_PDF
);

// GET /api/v1/pis/:id/download-excel - Gera o Excel da PI
router.get(
    '/:id/download-excel',
    validateIdParam,
    handleValidationErrors,
    piController.downloadPI_Excel
);

// GET /api/v1/pis/:id/pdf-template - Gera o PDF da PI (convertido do Excel)
router.get(
    '/:id/pdf-template',
    validateIdParam,
    handleValidationErrors,
    piController.downloadPI_PDF_FromExcel
);

logger.info('[Routes PI] Rotas de PIs definidas com sucesso.');

export default router;
