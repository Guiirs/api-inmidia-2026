/**
 * Public API Controller
 * Endpoints públicos
 */
// src/modules/public-api/public-api.controller.ts
import { Response, NextFunction } from 'express';
import { IApiKeyRequest } from '../../types/express';
import PublicApiService from './public-api.service';
import logger from '../../shared/container/logger';

// Instancia o serviço fora das funções do controller
const publicApiService = new PublicApiService();

function getQueryString(value: unknown, fallback = ''): string {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed && trimmed.toLowerCase() !== 'undefined' && trimmed.toLowerCase() !== 'null') {
            return trimmed;
        }
    }
    return fallback;
}

function getQueryNumber(value: unknown, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * Controller para obter as placas disponíveis para a empresa autenticada via API Key.
 * GET /api/v1/public/placas/disponiveis
 */
export async function getAvailablePlacas(req: IApiKeyRequest, res: Response, next: NextFunction): Promise<void> {
    logger.info(`[PublicApiController] Recebida requisição GET /public/placas/disponiveis.`);

    const empresa_id = req.empresa!._id;
    const empresaNome = req.empresa!.nome;

    logger.info(`[PublicApiController] Chave API validada para empresa: ${empresaNome} (ID: ${empresa_id}). Buscando placas disponíveis.`);

    try {
        const placas = await publicApiService.getAvailablePlacas(empresa_id.toString());

        logger.info(`[PublicApiController] getAvailablePlacas retornou ${placas.length} placas disponíveis para empresa ${empresa_id}.`);
        res.status(200).json(placas);
    } catch (err: any) {
        logger.error(`[PublicApiController] Erro ao chamar publicApiService.getAvailablePlacas para empresa ${empresa_id}: ${err.message}`, { status: err.status, stack: err.stack });
        next(err);
    }
}

/**
 * GET /api/v1/public/placas
 * Lista placas públicas da empresa autenticada por API Key (sem dados comerciais)
 */
export async function getPublicPlacas(req: IApiKeyRequest, res: Response, next: NextFunction): Promise<void> {
    const empresa_id = req.empresa!._id;

    try {
        const result = await publicApiService.getPublicPlacas(empresa_id.toString(), {
            page: getQueryNumber(req.query.page, 1),
            limit: getQueryNumber(req.query.limit, 24),
            regiaoId: getQueryString(req.query.regiaoId) || getQueryString(req.query.regiao_id),
            search: getQueryString(req.query.search) || getQueryString(req.query.q),
        });

        res.status(200).json({
            success: true,
            data: result.data,
            pagination: result.pagination,
        });
    } catch (err: any) {
        logger.error(`[PublicApiController] Erro ao listar placas públicas: ${err.message}`, { status: err.status, stack: err.stack });
        next(err);
    }
}

/**
 * GET /api/v1/public/placas/:id
 * Detalhe público de placa (sem dados comerciais)
 */
export async function getPublicPlacaById(req: IApiKeyRequest, res: Response, next: NextFunction): Promise<void> {
    const empresa_id = req.empresa!._id;
    const { id } = req.params;

    try {
        const placa = await publicApiService.getPublicPlacaById(empresa_id.toString(), String(id));
        res.status(200).json({
            success: true,
            data: placa,
        });
    } catch (err: any) {
        logger.error(`[PublicApiController] Erro ao buscar placa pública por ID: ${err.message}`, { status: err.status, stack: err.stack });
        next(err);
    }
}

/**
 * GET /api/v1/public/regioes
 * Lista regiões públicas da empresa autenticada por API Key
 */
export async function getPublicRegioes(req: IApiKeyRequest, res: Response, next: NextFunction): Promise<void> {
    const empresa_id = req.empresa!._id;

    try {
        const result = await publicApiService.getPublicRegioes(empresa_id.toString(), {
            page: getQueryNumber(req.query.page, 1),
            limit: getQueryNumber(req.query.limit, 100),
            search: getQueryString(req.query.search),
        });

        res.status(200).json({
            success: true,
            data: result.data,
            pagination: result.pagination,
        });
    } catch (err: any) {
        logger.error(`[PublicApiController] Erro ao listar regiões públicas: ${err.message}`, { status: err.status, stack: err.stack });
        next(err);
    }
}

export default {
    getAvailablePlacas,
    getPublicPlacas,
    getPublicPlacaById,
    getPublicRegioes,
};

