/**
 * Contrato Routes
 * Rotas com Dependency Injection
 */

import { Router } from 'express';
import { z } from 'zod';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { Log } from '@shared/core';
import { validate } from '@shared/infra/http/middlewares/validate.middleware';

// Dependency Injection
import { ContratoRepository } from './repositories/contrato.repository';
import { ContratoService } from './services/contrato.service';
import { ContratoController } from './controllers/contrato.controller';
import { CreateContratoSchema, UpdateContratoSchema, ListContratosQuerySchema } from './dtos/contrato.dto';

const router = Router();

Log.info('[Routes Contrato] Inicializando rotas de Contratos com DI...');

// Instanciar camadas
const contratoRepository = new ContratoRepository();
const contratoService = new ContratoService(contratoRepository);
const contratoController = new ContratoController(contratoService);

// Autenticacao em todas as rotas
router.use(authenticateToken);

const mongoIdRegex = /^[0-9a-fA-F]{24}$/;
const idParamsSchema = z.object({
  params: z.object({
    id: z.string().regex(mongoIdRegex, 'O ID do contrato fornecido e invalido.'),
  }),
});

const createContratoRequestSchema = z.object({ body: CreateContratoSchema });
const updateContratoRequestSchema = z.object({
  params: z.object({ id: z.string().regex(mongoIdRegex, 'O ID do contrato fornecido e invalido.') }),
  body: UpdateContratoSchema,
});
const listContratosRequestSchema = z.object({ query: ListContratosQuerySchema });

// POST /api/v1/contratos - Cria um contrato a partir de uma PI
router.post('/', validate(createContratoRequestSchema), contratoController.createContrato);

// GET /api/v1/contratos - Lista todos os contratos (com filtros)
router.get('/', validate(listContratosRequestSchema), contratoController.listContratos);

// GET /api/v1/contratos/:id - Busca um contrato especifico
router.get('/:id', validate(idParamsSchema), contratoController.getContratoById);

// PATCH /api/v1/contratos/:id - Atualiza um contrato (ex: status)
router.patch('/:id', validate(updateContratoRequestSchema), contratoController.updateContrato);

// DELETE /api/v1/contratos/:id - Apaga um contrato (apenas rascunho)
router.delete('/:id', validate(idParamsSchema), contratoController.deleteContrato);

// Rotas de download mantidas e centralizadas no controller DI.
router.get('/:id/download', validate(idParamsSchema), contratoController.downloadContratoPDF);
router.get('/:id/excel', validate(idParamsSchema), contratoController.downloadContratoExcel);
router.get('/:id/pdf-excel', validate(idParamsSchema), contratoController.downloadContratoPDFFromExcel);
router.get('/:id/pdf-template', validate(idParamsSchema), contratoController.downloadContratoPDFFromTemplate);

export default router;
