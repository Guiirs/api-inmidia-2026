import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '@shared/container/logger';
import { validate } from '@shared/infra/http/middlewares/validate.middleware';
import { PlacaController } from './controllers/placa.controller';
import { PlacaService } from './services/placa.service';
import { PlacaRepository } from './repositories/placa.repository';
import authMiddleware from '@shared/infra/http/middlewares/auth.middleware';
import { getSingleUploadMiddleware } from '@shared/infra/http/middlewares/upload.middleware';
import { placasCacheMiddleware } from '@shared/infra/http/middlewares/cache.middleware';
import { CreatePlacaSchema, UpdatePlacaSchema, ListPlacasQuerySchema } from './dtos/placa.dto';
import adminAuthMiddleware from '@shared/infra/http/middlewares/admin-auth.middleware';

const router = Router();

// Instancia o servico e controlador com injecao de dependencia
const placaRepository = new PlacaRepository();
const placaService = new PlacaService(placaRepository);
const placaController = new PlacaController(placaService);

logger.info('[Routes Placas] Componentes carregados com sucesso.');

// Middleware de autenticacao para todas as rotas
router.use(authMiddleware);
logger.debug('[Routes Placas] Middleware de Autenticacao aplicado a /placas/*.');

const mongoIdRegex = /^[0-9a-fA-F]{24}$/;
const idParamsSchema = z.object({
  params: z.object({
    id: z.string().regex(mongoIdRegex, 'O ID da placa fornecido e invalido.'),
  }),
});

const createPlacaRequestSchema = z.object({
  body: CreatePlacaSchema.extend({
    regiao: z.string().optional(),
    regiaoId: z.string().optional(),
  }).refine((data) => Boolean(data.regiaoId || data.regiao), {
    message: 'Regiao e obrigatoria',
    path: ['regiaoId'],
  }),
});

const updatePlacaRequestSchema = z.object({
  params: z.object({
    id: z.string().regex(mongoIdRegex, 'O ID da placa fornecido e invalido.'),
  }),
  body: UpdatePlacaSchema.extend({
    regiao: z.string().optional(),
    regiaoId: z.string().optional(),
  }),
});

const listPlacasRequestSchema = z.object({
  query: ListPlacasQuerySchema.partial(),
});

const disponibilidadeQuerySchema = z.object({
  query: z
    .object({
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
      data_inicio: z.string().optional(),
      data_fim: z.string().optional(),
      regiao: z.string().optional(),
      search: z.string().optional(),
      excludePiId: z.string().optional(),
    })
    .refine((q) => Boolean((q.dataInicio || q.data_inicio) && (q.dataFim || q.data_fim)), {
      message: 'Os parametros dataInicio e dataFim sao obrigatorios',
      path: ['dataInicio'],
    }),
});

logger.info('[Routes Placas] Definindo rotas de Placas...');

// GET /api/v1/placas/locations - Busca todas as localizacoes (coordenadas)
router.get('/locations', placasCacheMiddleware, placaController.getPlacaLocationsController.bind(placaController));

// Middleware para normalizar parametros de query (camelCase -> snake_case)
const normalizeQueryParams = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.query.dataInicio) {
    req.query.data_inicio = req.query.dataInicio;
  }
  if (req.query.dataFim) {
    req.query.data_fim = req.query.dataFim;
  }
  next();
};

// GET /api/v1/placas/disponiveis - Busca placas disponiveis por periodo
router.get(
  '/disponiveis',
  placasCacheMiddleware,
  normalizeQueryParams,
  validate(disponibilidadeQuerySchema),
  placaController.getPlacasDisponiveisController.bind(placaController)
);

// GET /api/v1/placas - Busca todas as placas (com filtros e paginacao)
router.get('/', placasCacheMiddleware, validate(listPlacasRequestSchema), placaController.getAllPlacasController.bind(placaController));

// POST /api/v1/placas - Cria uma nova placa (com upload)
router.post(
  '/',
  getSingleUploadMiddleware('imagem'),
  validate(createPlacaRequestSchema),
  placaController.createPlacaController.bind(placaController)
);

// GET /api/v1/placas/:id - Busca uma placa por ID
router.get('/:id', placasCacheMiddleware, validate(idParamsSchema), placaController.getPlacaByIdController.bind(placaController));

// PUT /api/v1/placas/:id - Atualiza uma placa existente (com upload)
router.put(
  '/:id',
  getSingleUploadMiddleware('imagem'),
  validate(updatePlacaRequestSchema),
  placaController.updatePlacaController.bind(placaController)
);

// DELETE /api/v1/placas/:id - Apaga uma placa
router.delete('/:id', validate(idParamsSchema), placaController.deletePlacaController.bind(placaController));

// PATCH /api/v1/placas/:id/disponibilidade - Alterna status de disponibilidade
router.patch(
  '/:id/disponibilidade',
  validate(idParamsSchema),
  placaController.toggleDisponibilidadeController.bind(placaController)
);

// POST /api/v1/admin/reorganizar-placas - Reorganiza numeração das placas (Admin)
router.post(
  '/admin/reorganizar-placas',
  adminAuthMiddleware,
  placaController.reorganizarPlacasController.bind(placaController)
);

logger.info('[Routes Placas] Rotas de Placas definidas com sucesso.');

export default router;
