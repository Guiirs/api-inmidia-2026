/**
 * PI Controller
 * Endpoints de propostas internas
 */
// src/modules/propostas-internas/pi.controller.ts
import { Response, NextFunction } from 'express';
import { IAuthRequest } from '../../../types/express';
import PIService from './pi.service';
import logger from '@shared/container/logger';
import AppError from '@shared/container/AppError';

const piService = new PIService();

/**
 * Cria PI
 */
export async function createPI(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    logger.info(`[PiController] createPI requisitado por empresa ${empresaId}.`);
    logger.debug(`[PiController] req.body recebido: ${JSON.stringify(req.body, null, 2)}`);
    logger.debug(`[PiController] Placas recebidas: ${JSON.stringify(req.body.placas)}`);
    
    try {
        const piData = { ...req.body, cliente: req.body.clienteId };
        logger.debug(`[PiController] piData que será enviado ao service: ${JSON.stringify(piData, null, 2)}`);
        
        const novaPI = await piService.create(piData, empresaId);
        
        logger.info(`[PiController] PI criada com sucesso. ID: ${novaPI._id}, Placas: ${novaPI.placas?.length || 0}`);
        
        res.status(201).json(novaPI);
    } catch (err: any) {
        logger.error(`[PiController] Erro ao criar PI: ${err.message}`, { stack: err.stack });
        next(err);
    }
}

/**
 * Lista PIs
 */
export async function getAllPIs(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    logger.info(`[PiController] getAllPIs requisitado por empresa ${empresaId}.`);
    try {
        const result = await piService.getAll(empresaId, req.query);
        res.status(200).json(result);
    } catch (err: any) {
        next(err);
    }
}

/**
 * Busca PI por ID
 */
export async function getPIById(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const { id } = req.params;
    if (!id) {
        next(new AppError('ID da PI Ã© obrigatÃ³rio.', 400));
        return;
    }
    logger.info(`[PiController] getPIById ${id} requisitado por empresa ${empresaId}.`);
    try {
        const pi = await piService.getById(id, empresaId);
        res.status(200).json(pi);
    } catch (err: any) {
        next(err);
    }
}

/**
 * Atualiza PI
 */
export async function updatePI(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const { id } = req.params;
    if (!id) {
        next(new AppError('ID da PI Ã© obrigatÃ³rio.', 400));
        return;
    }
    logger.info(`[PiController] updatePI ${id} requisitado por empresa ${empresaId}.`);
    try {
        const piData = { ...req.body, cliente: req.body.clienteId };
        const piAtualizada = await piService.update(id, piData, empresaId);
        res.status(200).json(piAtualizada);
    } catch (err: any) {
        next(err);
    }
}

/**
 * Deleta PI
 */
export async function deletePI(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const { id } = req.params;
    if (!id) {
        next(new AppError('ID da PI Ã© obrigatÃ³rio.', 400));
        return;
    }
    logger.info(`[PiController] deletePI ${id} requisitado por empresa ${empresaId}.`);
    try {
        await piService.delete(id, empresaId);
        res.status(204).send();
    } catch (err: any) {
        next(err);
    }
}

/**
 * Download PDF da PI
 */
export async function downloadPI_PDF(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const userId = (req.user as any).id;
    const { id } = req.params;
    if (!id) {
        next(new AppError('ID da PI Ã© obrigatÃ³rio.', 400));
        return;
    }
    logger.info(`[PiController] downloadPI_PDF ${id} requisitado por user ${userId} (Empresa ${empresaId}).`);
    try {
        await piService.generatePDF(id, empresaId, userId, res);
    } catch (err: any) {
        next(err);
    }
}

/**
 * Download Excel da PI
 */
export async function downloadPI_Excel(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const { id } = req.params;
    if (!id) {
        next(new AppError('ID da PI Ã© obrigatÃ³rio.', 400));
        return;
    }
    logger.info(`[PiController] downloadPI_Excel ${id} requisitado por empresa ${empresaId}.`);
    try {
        await piService.generateExcel(id, empresaId, res);
    } catch (err: any) {
        next(err);
    }
}

/**
 * Download PDF da PI (convertido do Excel)
 */
export async function downloadPI_PDF_FromExcel(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const { id } = req.params;
    if (!id) {
        next(new AppError('ID da PI Ã© obrigatÃ³rio.', 400));
        return;
    }
    logger.info(`[PiController] downloadPI_PDF_FromExcel ${id} requisitado por empresa ${empresaId}.`);
    try {
        await piService.generatePDFFromExcel(id, empresaId, res);
    } catch (err: any) {
        next(err);
    }
}

export default {
    createPI,
    getAllPIs,
    getPIById,
    updatePI,
    deletePI,
    downloadPI_PDF,
    downloadPI_Excel,
    downloadPI_PDF_FromExcel
};

