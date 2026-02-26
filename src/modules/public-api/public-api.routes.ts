/**
 * Public API Routes
 * Rotas publicas
 */
import { Router } from 'express';
import logger from '../../shared/container/logger';
import * as publicApiController from './public-api.controller';
import apiKeyAuthMiddleware from '../../shared/infra/http/middlewares/api-key-auth.middleware';

const router = Router();

logger.info('[Routes PublicAPI] Componentes carregados com sucesso.');
logger.info('[Routes PublicAPI] Definindo rotas da API Publica...');

// Aplica o middleware de autenticacao por API Key a todas as rotas publicas
router.use(apiKeyAuthMiddleware);
logger.debug('[Routes PublicAPI] Middleware de API Key aplicado a /public/*.');

// GET /api/v1/public/placas/disponiveis
router.get('/placas/disponiveis', publicApiController.getAvailablePlacas);
logger.debug('[Routes PublicAPI] Rota GET /placas/disponiveis definida (Placas Disponiveis).');

// GET /api/v1/public/placas - Listagem publica de placas (sem dados comerciais)
router.get('/placas', publicApiController.getPublicPlacas);
logger.debug('[Routes PublicAPI] Rota GET /placas definida (Placas Publicas).');

// GET /api/v1/public/placas-detalhe?id=... - Detalhe publico via query param (compat JetEngine)
router.get('/placas-detalhe', publicApiController.getPublicPlacaByQuery);
logger.debug('[Routes PublicAPI] Rota GET /placas-detalhe definida (Detalhe Publico por Query).');

// GET /api/v1/public/placas/:id - Detalhe publico de placa
router.get('/placas/:id', publicApiController.getPublicPlacaById);
logger.debug('[Routes PublicAPI] Rota GET /placas/:id definida (Detalhe Publico de Placa).');

// GET /api/v1/public/regioes - Listagem publica de regioes
router.get('/regioes', publicApiController.getPublicRegioes);
logger.debug('[Routes PublicAPI] Rota GET /regioes definida (Regioes Publicas).');

logger.info('[Routes PublicAPI] Rotas da API Publica definidas com sucesso.');
logger.debug('[Routes PublicAPI] Router exportado.');

export default router;
