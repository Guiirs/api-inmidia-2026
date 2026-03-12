/**
 * Relatorio Controller
 * Camada HTTP para relatorios
 */

import { Request, Response } from 'express';
import { Log } from '@shared/core';
import { getErrorStatusCode } from '@shared/core';
import type { RelatorioService } from '../services/relatorio.service';
import type { IAuthRequest } from '../../../types/express';
import LegacyRelatorioService from '../relatorio.service';
import { PeriodoQuerySchema } from '../dtos/relatorio.dto';
import logger from '@shared/container/logger';
import { auditService } from '@modules/audit';

export class RelatorioController {
  constructor(
    private readonly service: RelatorioService,
    private readonly legacyService = new LegacyRelatorioService()
  ) {}

  getDashboardSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const empresaId = authReq.user?.empresaId;

      if (!empresaId) {
        res.status(401).json({
          success: false,
          error: 'Usuario nao autenticado',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const result = await this.service.getDashboardSummary(empresaId.toString());

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value,
      });
    } catch (error) {
      Log.error('[RelatorioController] Erro ao buscar dashboard summary', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao buscar resumo',
        code: 'INTERNAL_ERROR',
      });
    }
  };

  getPlacasPorRegiao = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const empresaId = authReq.user?.empresaId;

      if (!empresaId) {
        res.status(401).json({
          success: false,
          error: 'Usuario nao autenticado',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const result = await this.service.getPlacasPorRegiao(empresaId.toString());

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value,
      });
    } catch (error) {
      Log.error('[RelatorioController] Erro ao buscar placas por regiao', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao buscar placas',
        code: 'INTERNAL_ERROR',
      });
    }
  };

  getOcupacaoPorPeriodo = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const empresaId = authReq.user?.empresaId;

      if (!empresaId) {
        res.status(401).json({
          success: false,
          error: 'Usuario nao autenticado',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const result = await this.service.getOcupacaoPorPeriodo(empresaId.toString(), req.query as any);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value,
      });
    } catch (error) {
      Log.error('[RelatorioController] Erro ao calcular ocupacao', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao calcular ocupacao',
        code: 'INTERNAL_ERROR',
      });
    }
  };

  exportOcupacaoPdf = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const empresaId = authReq.user?.empresaId;
      const userId = authReq.user?.id;

      if (!empresaId || !userId) {
        res.status(401).json({
          success: false,
          error: 'Usuario nao autenticado',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const parsed = PeriodoQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        const firstError = parsed.error.issues[0]?.message || 'Parametros invalidos';
        res.status(400).json({ message: firstError });
        return;
      }

      const dataInicio = new Date(parsed.data.dataInicio);
      const dataFim = new Date(parsed.data.dataFim);

      const periodRangeDays = Math.ceil((dataFim.getTime() - dataInicio.getTime()) / 86400000);
      if (periodRangeDays > 366) {
        res.status(400).json({
          success: false,
          error: 'Intervalo maximo de 366 dias excedido',
          code: 'INVALID_RANGE',
        });
        return;
      }

      logger.info(
        `[RelatorioController] exportOcupacaoPdf requisitado por user ${userId} empresa ${empresaId.toString()}`
      );
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Download-Options', 'noopen');

      void auditService
        .log({
          userId,
          action: 'READ',
          resource: 'relatorio',
          resourceId: 'ocupacao-por-periodo',
          ip: req.ip,
          newData: {
            dataInicio: dataInicio.toISOString(),
            dataFim: dataFim.toISOString(),
          },
        })
        .catch((error) => {
          logger.error(
            `[RelatorioController] Falha ao registrar auditoria export relatorio: ${
              (error as any)?.message || 'erro desconhecido'
            }`
          );
        });

      const reportData = await this.legacyService.ocupacaoPorPeriodo(
        empresaId.toString(),
        dataInicio,
        dataFim
      );
      await this.legacyService.generateOcupacaoPdf(reportData, dataInicio, dataFim, res);
    } catch (error) {
      Log.error('[RelatorioController] Erro ao exportar PDF de ocupacao', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao exportar PDF',
        code: 'INTERNAL_ERROR',
      });
    }
  };
}
