/**
 * Contrato Routes
 * Rotas com Dependency Injection
 */

import { Router } from 'express';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { body, param } from 'express-validator';
import { handleValidationErrors } from '@modules/auth/authValidator';
import { Log } from '@shared/core';

// Dependency Injection
import { ContratoRepository } from './repositories/contrato.repository';
import { ContratoService } from './services/contrato.service';
import { ContratoController } from './controllers/contrato.controller';
import * as legacyContratoController from './contrato.controller';

const router = Router();

Log.info('[Routes Contrato] Inicializando rotas de Contratos com DI...');

// Instanciar camadas
const contratoRepository = new ContratoRepository();
const contratoService = new ContratoService(contratoRepository);
const contratoController = new ContratoController(contratoService);

// Autenticação em todas as rotas
router.use(authenticateToken);

// Validações
const validateIdParam = [
    param('id').isMongoId().withMessage('O ID do contrato fornecido é inválido.')
];

const validateContratoCreateBody = [
    body('piId')
        .notEmpty().withMessage('O ID da PI (Proposta Interna) é obrigatório.')
        .isMongoId().withMessage('O ID da PI é inválido.')
];

const validateContratoUpdateBody = [
    body('status')
        .optional()
        .isIn(['rascunho', 'ativo', 'concluido', 'cancelado'])
        .withMessage("O status fornecido é inválido. Valores permitidos: 'rascunho', 'ativo', 'concluido', 'cancelado'.")
];

// POST /api/v1/contratos - Cria um contrato a partir de uma PI
router.post(
    '/',
    validateContratoCreateBody,
    handleValidationErrors,
    contratoController.createContrato
);

// GET /api/v1/contratos - Lista todos os contratos (com filtros)
router.get(
    '/',
    contratoController.listContratos
);

// GET /api/v1/contratos/:id - Busca um contrato específico
router.get(
    '/:id',
    validateIdParam,
    handleValidationErrors,
    contratoController.getContratoById
);

// PATCH /api/v1/contratos/:id - Atualiza um contrato (ex: status)
router.patch(
    '/:id',
    validateIdParam,
    validateContratoUpdateBody,
    handleValidationErrors,
    contratoController.updateContrato
);

// DELETE /api/v1/contratos/:id - Apaga um contrato (apenas rascunho)
router.delete(
    '/:id',
    validateIdParam,
    handleValidationErrors,
    contratoController.deleteContrato
);

// TODO: Rotas de PDF/Excel serão migradas posteriormente
// GET /api/v1/contratos/:id/download - Gera o PDF do contrato
// GET /api/v1/contratos/:id/excel - Gera o EXCEL do contrato
// GET /api/v1/contratos/:id/pdf-excel - Gera o PDF baseado no Excel
// GET /api/v1/contratos/:id/pdf-template - Gera PDF a partir de Excel Template

// Rotas de compatibilidade (bridge) enquanto os downloads nao sao migrados
// para controllers/contrato.controller.ts (DI/refactor).
router.get(
    '/:id/download',
    validateIdParam,
    handleValidationErrors,
    legacyContratoController.downloadContrato_PDF
);

router.get(
    '/:id/excel',
    validateIdParam,
    handleValidationErrors,
    legacyContratoController.downloadContrato_Excel
);

router.get(
    '/:id/pdf-template',
    validateIdParam,
    handleValidationErrors,
    legacyContratoController.downloadContrato_PDF_FromTemplate
);

export default router;

