import { Router } from 'express';
import { param } from 'express-validator';
import logger from '@shared/container/logger';
import { PlacaController } from './controllers/placa.controller';
import { PlacaService } from './services/placa.service';
import { PlacaRepository } from './repositories/placa.repository';
import authMiddleware from '@shared/infra/http/middlewares/auth.middleware';
import { getSingleUploadMiddleware } from '@shared/infra/http/middlewares/upload.middleware';
import { placasCacheMiddleware } from '@shared/infra/http/middlewares/cache.middleware';
import {
    placaValidationRules,
    disponibilidadeValidationRules,
    handleValidationErrors
} from './placaValidator';

const router = Router();

// Instancia o serviço e controlador com injeção de dependência
const placaRepository = new PlacaRepository();
const placaService = new PlacaService(placaRepository);
const placaController = new PlacaController(placaService);

logger.info('[Routes Placas] Componentes carregados com sucesso.');

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);
logger.debug('[Routes Placas] Middleware de Autenticação aplicado a /placas/*.');

// Validação para IDs nos parâmetros da URL
const validateIdParam = [
    param('id').isMongoId().withMessage('O ID da placa fornecido é inválido.')
];

logger.info('[Routes Placas] Definindo rotas de Placas...');

// GET /api/v1/placas/locations - Busca todas as localizações (coordenadas)
router.get(
    '/locations',
    placasCacheMiddleware,
    placaController.getPlacaLocationsController.bind(placaController)
);
logger.debug('[Routes Placas] Rota GET /locations definida (Buscar Localizações).');

// Middleware para normalizar parâmetros de query (camelCase -> snake_case)
const normalizeQueryParams = (req: any, _res: any, next: any) => {
    logger.debug(`[normalizeQueryParams] Query ANTES: ${JSON.stringify(req.query)}`);
    if (req.query.dataInicio) {
        req.query.data_inicio = req.query.dataInicio;
        logger.debug(`[normalizeQueryParams] ✅ Adicionado data_inicio: ${req.query.data_inicio}`);
    }
    if (req.query.dataFim) {
        req.query.data_fim = req.query.dataFim;
        logger.debug(`[normalizeQueryParams] ✅ Adicionado data_fim: ${req.query.data_fim}`);
    }
    logger.debug(`[normalizeQueryParams] Query DEPOIS: ${JSON.stringify(req.query)}`);
    next();
};

// GET /api/v1/placas/disponiveis - Busca placas disponíveis por período
router.get(
    '/disponiveis',
    placasCacheMiddleware,
    normalizeQueryParams,
    disponibilidadeValidationRules,
    handleValidationErrors,
    placaController.getPlacasDisponiveisController.bind(placaController)
);
logger.debug('[Routes Placas] Rota GET /disponiveis definida (Buscar Placas Disponíveis por Período).');

// GET /api/v1/placas - Busca todas as placas (com filtros e paginação)
router.get('/', placasCacheMiddleware, placaController.getAllPlacasController.bind(placaController));
logger.debug('[Routes Placas] Rota GET / definida (Listar Placas).');

// POST /api/v1/placas - Cria uma nova placa (com upload)
router.post(
    '/',
    getSingleUploadMiddleware('imagem'),
    placaValidationRules,
    handleValidationErrors,
    placaController.createPlacaController.bind(placaController)
);
logger.debug('[Routes Placas] Rota POST / definida (Criar Placa com Upload e Validação).');

// GET /api/v1/placas/:id - Busca uma placa por ID
router.get(
    '/:id',
    placasCacheMiddleware,
    validateIdParam,
    handleValidationErrors,
    placaController.getPlacaByIdController.bind(placaController)
);
logger.debug('[Routes Placas] Rota GET /:id definida (Buscar Placa por ID).');

// PUT /api/v1/placas/:id - Atualiza uma placa existente (com upload)
router.put(
    '/:id',
    getSingleUploadMiddleware('imagem'),
    validateIdParam,
    placaValidationRules,
    handleValidationErrors,
    placaController.updatePlacaController.bind(placaController)
);
logger.debug('[Routes Placas] Rota PUT /:id definida (Atualizar Placa com Upload e Validação).');

// DELETE /api/v1/placas/:id - Apaga uma placa
router.delete(
    '/:id',
    validateIdParam,
    handleValidationErrors,
    placaController.deletePlacaController.bind(placaController)
);
logger.debug('[Routes Placas] Rota DELETE /:id definida (Apagar Placa).');

// PATCH /api/v1/placas/:id/disponibilidade - Alterna status de disponibilidade (manutenção)
router.patch(
    '/:id/disponibilidade',
    validateIdParam,
    handleValidationErrors,
    placaController.toggleDisponibilidadeController.bind(placaController)
);
logger.debug('[Routes Placas] Rota PATCH /:id/disponibilidade definida (Toggle Disponibilidade).');

logger.info('[Routes Placas] Rotas de Placas definidas com sucesso.');

export default router;
