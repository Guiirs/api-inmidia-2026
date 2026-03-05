/**
 * Relatorio Controller (OLD)
 * DEPRECADO: Use controllers/relatorio.controller.ts
 */
import { Request, Response, NextFunction } from 'express';
import { IAuthRequest } from '../../types/express';
import RelatorioService from './relatorio.service';
import logger from '../../shared/container/logger';
import { PeriodoQuerySchema } from './dtos/relatorio.dto';

const relatorioService = new RelatorioService();

export async function getPlacasPorRegiao(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
  const empresa_id = (req.user as { empresaId?: string } | undefined)?.empresaId;
  const userId = (req.user as { id?: string } | undefined)?.id;

  logger.info(`[RelatorioController] Utilizador ${userId} requisitou getPlacasPorRegiao para empresa ${empresa_id}.`);

  try {
    const data = await relatorioService.placasPorRegiao(String(empresa_id));
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function getDashboardSummary(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
  const empresa_id = (req.user as { empresaId?: string } | undefined)?.empresaId;
  const userId = (req.user as { id?: string } | undefined)?.id;

  logger.info(`[RelatorioController] Utilizador ${userId} requisitou getDashboardSummary para empresa ${empresa_id}.`);

  try {
    const summary = await relatorioService.getDashboardSummary(String(empresa_id));
    res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
}

export async function getOcupacaoPorPeriodo(req: Request, res: Response, next: NextFunction): Promise<void> {
  const empresa_id = (req as Request & { user?: { empresaId?: string } }).user?.empresaId;

  const parsed = PeriodoQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Parametros invalidos';
    res.status(400).json({ message: firstError });
    return;
  }

  const dataInicio = new Date(parsed.data.dataInicio);
  const dataFim = new Date(parsed.data.dataFim);

  try {
    const reportData = await relatorioService.ocupacaoPorPeriodo(String(empresa_id), dataInicio, dataFim);
    res.status(200).json(reportData);
  } catch (err) {
    next(err);
  }
}

export async function exportOcupacaoPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
  const reqWithUser = req as Request & { user?: { empresaId?: string; id?: string } };
  const empresa_id = reqWithUser.user?.empresaId;
  const userId = reqWithUser.user?.id;

  logger.info(`[RelatorioController] Utilizador ${userId} requisitou exportacao PDF de Ocupacao.`);

  const parsed = PeriodoQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Parametros invalidos';
    res.status(400).json({ message: firstError });
    return;
  }

  const dataInicio = new Date(parsed.data.dataInicio);
  const dataFim = new Date(parsed.data.dataFim);

  try {
    const reportData = await relatorioService.ocupacaoPorPeriodo(String(empresa_id), dataInicio, dataFim);
    await relatorioService.generateOcupacaoPdf(reportData, dataInicio, dataFim, res);
  } catch (err) {
    next(err);
  }
}

export default {
  getPlacasPorRegiao,
  getDashboardSummary,
  getOcupacaoPorPeriodo,
  exportOcupacaoPdf
};
