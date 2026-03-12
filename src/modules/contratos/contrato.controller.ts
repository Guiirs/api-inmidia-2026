/**
 * Contrato Controller (OLD)
 * DEPRECADO: Use controllers/contrato.controller.ts
 */
// src/controllers/contratoController.ts
import { Response, NextFunction } from 'express';
import { IAuthRequest } from '../../../types/express';
import ContratoService from './contrato.service';
import logger from '@shared/container/logger';
import AppError from '@shared/container/AppError';
import { auditService } from '@modules/audit';

const contratoService = new ContratoService();

function applySecureDownloadHeaders(res: Response): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Download-Options', 'noopen');
}

function logExportAudit(userId: string, resource: string, resourceId: string, req: IAuthRequest): void {
  void auditService
    .log({
      userId,
      action: 'READ',
      resource,
      resourceId,
      ip: req.ip,
    })
    .catch((error) => {
      logger.error(
        `[ContratoController] Falha ao registrar auditoria export para ${resource}/${resourceId}: ${
          (error as any)?.message || 'erro desconhecido'
        }`
      );
    });
}

/**
 * Cria Contrato
 */
export async function createContrato(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
  const empresaId = (req.user as any).empresaId;
  const { piId } = req.body;
  logger.info(`[ContratoController] createContrato requisitado para PI ${piId} (Empresa ${empresaId}).`);
  try {
    const novoContrato = await contratoService.create(piId, empresaId);
    res.status(201).json(novoContrato);
  } catch (err: any) {
    next(err);
  }
}

/**
 * Lista todos os Contratos (com paginacao e filtros)
 */
export async function getAllContratos(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
  const empresaId = (req.user as any).empresaId;
  logger.info(`[ContratoController] getAllContratos requisitado por empresa ${empresaId}.`);
  try {
    const result = await contratoService.getAll(empresaId, req.query);
    res.status(200).json(result);
  } catch (err: any) {
    next(err);
  }
}

/**
 * Busca um Contrato especifico pelo ID
 */
export async function getContratoById(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
  const empresaId = (req.user as any).empresaId;
  const { id } = req.params;
  if (!id) {
    next(new AppError('ID do contrato ÃƒÂ© obrigatorio.', 400));
    return;
  }
  logger.info(`[ContratoController] getContratoById ${id} requisitado por empresa ${empresaId}.`);
  try {
    const contrato = await contratoService.getById(id, empresaId);
    res.status(200).json(contrato);
  } catch (err: any) {
    next(err);
  }
}

/**
 * Atualiza um Contrato
 */
export async function updateContrato(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
  const empresaId = (req.user as any).empresaId;
  const { id } = req.params;
  if (!id) {
    next(new AppError('ID do contrato ÃƒÂ© obrigatorio.', 400));
    return;
  }
  logger.info(`[ContratoController] updateContrato ${id} requisitado por empresa ${empresaId}.`);
  try {
    const contratoAtualizado = await contratoService.update(id, req.body, empresaId);
    res.status(200).json(contratoAtualizado);
  } catch (err: any) {
    next(err);
  }
}

/**
 * Deleta um Contrato
 */
export async function deleteContrato(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
  const empresaId = (req.user as any).empresaId;
  const { id } = req.params;
  if (!id) {
    next(new AppError('ID do contrato ÃƒÂ© obrigatorio.', 400));
    return;
  }
  logger.info(`[ContratoController] deleteContrato ${id} requisitado por empresa ${empresaId}.`);
  try {
    await contratoService.delete(id, empresaId);
    res.status(204).send();
  } catch (err: any) {
    next(err);
  }
}

/**
 * Download PDF do Contrato
 */
export async function downloadContrato_PDF(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
  const empresaId = (req.user as any).empresaId;
  const userId = (req.user as any).id;
  const { id } = req.params;
  if (!id) {
    next(new AppError('ID do contrato ÃƒÂ© obrigatorio.', 400));
    return;
  }
  if (!userId) {
    next(new AppError('Usuario nao autenticado.', 401));
    return;
  }
  logger.info(`[ContratoController] downloadContrato_PDF ${id} requisitado por user ${userId} (Empresa ${empresaId}).`);
  try {
    applySecureDownloadHeaders(res);
    logExportAudit(userId, 'contrato', id, req);
    await contratoService.generatePDF(id, empresaId, res);
  } catch (err: any) {
    next(err);
  }
}

/**
 * Download Excel do Contrato
 */
export async function downloadContrato_Excel(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
  const empresaId = (req.user as any).empresaId;
  const userId = (req.user as any).id;
  const { id } = req.params;
  if (!id) {
    next(new AppError('ID do contrato ÃƒÂ© obrigatorio.', 400));
    return;
  }
  if (!userId) {
    next(new AppError('Usuario nao autenticado.', 401));
    return;
  }
  logger.info(`[ContratoController] downloadContrato_Excel ${id} requisitado por user ${userId} (Empresa ${empresaId}).`);
  try {
    applySecureDownloadHeaders(res);
    logExportAudit(userId, 'contrato', id, req);
    await contratoService.generateExcel(id, empresaId, res);
  } catch (err: any) {
    next(err);
  }
}

/**
 * Download PDF do Contrato (Baseado no Excel)
 */
export async function downloadContrato_PDF_FromExcel(
  req: IAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const empresaId = (req.user as any).empresaId;
  const userId = (req.user as any).id;
  const { id } = req.params;
  if (!id) {
    next(new AppError('ID do contrato ÃƒÂ© obrigatorio.', 400));
    return;
  }
  if (!userId) {
    next(new AppError('Usuario nao autenticado.', 401));
    return;
  }
  logger.info(`[ContratoController] downloadContrato_PDF_FromExcel ${id} requisitado por user ${userId} (Empresa ${empresaId}).`);
  try {
    applySecureDownloadHeaders(res);
    logExportAudit(userId, 'contrato', id, req);
    await contratoService.generatePDFFromExcel(id, empresaId, res);
  } catch (err: any) {
    next(err);
  }
}

/**
 * Download PDF do Contrato a partir de Excel Template (NOVO - conversor XLSX to PDF)
 */
export async function downloadContrato_PDF_FromTemplate(
  req: IAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const empresaId = (req.user as any).empresaId;
  const userId = (req.user as any).id;
  const { id } = req.params;
  if (!id) {
    next(new AppError('ID do contrato ÃƒÂ© obrigatorio.', 400));
    return;
  }
  if (!userId) {
    next(new AppError('Usuario nao autenticado.', 401));
    return;
  }
  logger.info(`[ContratoController] downloadContrato_PDF_FromTemplate ${id} requisitado por user ${userId} (Empresa ${empresaId}).`);
  try {
    applySecureDownloadHeaders(res);
    logExportAudit(userId, 'contrato', id, req);
    await contratoService.generatePDFFromExcelTemplate(id, empresaId, res);
  } catch (err: any) {
    next(err);
  }
}

export default {
  createContrato,
  getAllContratos,
  getContratoById,
  updateContrato,
  deleteContrato,
  downloadContrato_PDF,
  downloadContrato_Excel,
  downloadContrato_PDF_FromExcel,
  downloadContrato_PDF_FromTemplate,
};
