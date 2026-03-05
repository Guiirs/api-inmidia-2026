/**
 * Aluguel Routes
 * Rotas com Dependency Injection
 */

import { Router } from 'express';
import { z } from 'zod';
import authenticateToken from '@middlewares/auth.middleware';
import { Log } from '@shared/core';
import { validate } from '@shared/infra/http/middlewares/validate.middleware';

// Dependency Injection
import { AluguelRepository } from './repositories/aluguel.repository';
import { AluguelService } from './services/aluguel.service';
import { AluguelController } from './controllers/aluguel.controller';

import {
  CreateAluguelSchema,
  UpdateAluguelSchema,
  CheckDisponibilidadeAluguelSchema,
  ListAlugueisQuerySchema,
} from './dtos/aluguel.dto';

const router = Router();

Log.info('[Routes Aluguel] Inicializando rotas de Alugueis com DI...');

// Instanciar camadas
const aluguelRepository = new AluguelRepository();
const aluguelService = new AluguelService(aluguelRepository);
const aluguelController = new AluguelController(aluguelService);

// Autenticacao em todas as rotas
router.use(authenticateToken);

const mongoIdRegex = /^[0-9a-fA-F]{24}$/;

const idParamsSchema = z.object({
  params: z.object({
    id: z.string().regex(mongoIdRegex, 'O ID do aluguel fornecido e invalido.'),
  }),
});

const biWeekParamsSchema = z.object({
  params: z.object({
    biWeekId: z.string().min(1, 'biWeekId e obrigatorio.'),
  }),
});

const createAluguelRequestSchema = z.object({ body: CreateAluguelSchema });
const listAlugueisRequestSchema = z.object({ query: ListAlugueisQuerySchema });
const checkDisponibilidadeRequestSchema = z.object({ body: CheckDisponibilidadeAluguelSchema });
const updateAluguelRequestSchema = z.object({
  params: z.object({
    id: z.string().regex(mongoIdRegex, 'O ID do aluguel fornecido e invalido.'),
  }),
  body: UpdateAluguelSchema,
});

// POST /api/v1/alugueis - Cria um novo aluguel
router.post('/', validate(createAluguelRequestSchema), aluguelController.createAluguel);

// GET /api/v1/alugueis - Lista todos os alugueis (com filtros)
router.get('/', validate(listAlugueisRequestSchema), aluguelController.listAlugueis);

// Rotas BI-Week migradas para o controller DI
router.get(
  '/bi-week/:biWeekId',
  validate(biWeekParamsSchema),
  aluguelController.getAlugueisByBiWeek
);

router.get(
  '/bi-week/:biWeekId/disponiveis',
  validate(biWeekParamsSchema),
  aluguelController.getPlacasDisponiveisByBiWeek
);

router.get(
  '/bi-week/:biWeekId/relatorio',
  validate(biWeekParamsSchema),
  aluguelController.getRelatorioOcupacaoBiWeek
);

// GET /api/v1/alugueis/:id - Busca um aluguel especifico
router.get('/:id', validate(idParamsSchema), aluguelController.getAluguelById);

// PATCH /api/v1/alugueis/:id - Atualiza um aluguel
router.patch('/:id', validate(updateAluguelRequestSchema), aluguelController.updateAluguel);

// DELETE /api/v1/alugueis/:id - Deleta um aluguel
router.delete('/:id', validate(idParamsSchema), aluguelController.deleteAluguel);

// POST /api/v1/alugueis/check-disponibilidade - Verifica disponibilidade
router.post(
  '/check-disponibilidade',
  validate(checkDisponibilidadeRequestSchema),
  aluguelController.checkDisponibilidade
);

Log.info('[Routes Aluguel] Rotas de Alugueis definidas com sucesso.');

export default router;
