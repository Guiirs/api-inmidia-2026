/**
 * Relatorio Controller
 * Camada HTTP para relatórios
 */

import { Request, Response } from 'express';
import { Log } from '@shared/core';
import { getErrorStatusCode } from '@shared/core';
import type { RelatorioService } from '../services/relatorio.service';
import type { IAuthRequest } from '../../../types/express';

export class RelatorioController {
  
  constructor(private readonly service: RelatorioService) {}

  /**
   * GET /relatorios/dashboard-summary
   * Busca resumo para dashboard
   */
  getDashboardSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const empresaId = authReq.user?.empresaId;

      if (!empresaId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const result = await this.service.getDashboardSummary(empresaId.toString());

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });

    } catch (error) {
      Log.error('[RelatorioController] Erro ao buscar dashboard summary', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao buscar resumo',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * GET /relatorios/placas-por-regiao
   * Busca placas agrupadas por região
   */
  getPlacasPorRegiao = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const empresaId = authReq.user?.empresaId;

      if (!empresaId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const result = await this.service.getPlacasPorRegiao(empresaId.toString());

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });

    } catch (error) {
      Log.error('[RelatorioController] Erro ao buscar placas por região', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao buscar placas',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * GET /relatorios/ocupacao-por-periodo
   * Calcula ocupação por período
   */
  getOcupacaoPorPeriodo = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const empresaId = authReq.user?.empresaId;

      if (!empresaId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const result = await this.service.getOcupacaoPorPeriodo(
        empresaId.toString(),
        req.query as any
      );

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });

    } catch (error) {
      Log.error('[RelatorioController] Erro ao calcular ocupação', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao calcular ocupação',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}
