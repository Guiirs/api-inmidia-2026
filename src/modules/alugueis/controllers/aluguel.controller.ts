/**
 * Aluguel Controller
 * Camada HTTP com Result pattern e cache
 */

import { Request, Response } from 'express';
import { Log } from '@shared/core';
import { getErrorStatusCode } from '@shared/core';
import type { AluguelService } from '../services/aluguel.service';
import type { IAuthRequest } from '../../../types/express';

export class AluguelController {
  
  constructor(private readonly service: AluguelService) {}

  /**
   * POST /alugueis
   * Cria um novo aluguel
   */
  createAluguel = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.service.createAluguel(
        req.body,
        empresaId.toString()
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

      res.status(201).json({
        success: true,
        data: result.value
      });

    } catch (error) {
      Log.error('[AluguelController] Erro ao criar aluguel', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao criar aluguel',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * GET /alugueis
   * Lista aluguéis com filtros e paginação
   */
  listAlugueis = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.service.listAlugueis(
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
        ...result.value
      });

    } catch (error) {
      Log.error('[AluguelController] Erro ao listar aluguéis', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao listar aluguéis',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * GET /alugueis/:id
   * Busca aluguel por ID
   */
  getAluguelById = async (req: Request, res: Response): Promise<void> => {
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

      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID não fornecido',
          code: 'INVALID_ID'
        });
        return;
      }

      const result = await this.service.getAluguelById(
        id,
        empresaId.toString()
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
      Log.error('[AluguelController] Erro ao buscar aluguel', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao buscar aluguel',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * PATCH /alugueis/:id
   * Atualiza aluguel
   */
  updateAluguel = async (req: Request, res: Response): Promise<void> => {
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

      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID não fornecido',
          code: 'INVALID_ID'
        });
        return;
      }

      const result = await this.service.updateAluguel(
        id,
        req.body,
        empresaId.toString()
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
      Log.error('[AluguelController] Erro ao atualizar aluguel', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao atualizar aluguel',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * DELETE /alugueis/:id
   * Deleta aluguel
   */
  deleteAluguel = async (req: Request, res: Response): Promise<void> => {
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

      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID não fornecido',
          code: 'INVALID_ID'
        });
        return;
      }

      const result = await this.service.deleteAluguel(
        id,
        empresaId.toString()
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
        message: 'Aluguel deletado com sucesso'
      });

    } catch (error) {
      Log.error('[AluguelController] Erro ao deletar aluguel', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao deletar aluguel',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * POST /alugueis/check-disponibilidade
   * Verifica disponibilidade de placa no período
   */
  checkDisponibilidade = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.service.checkDisponibilidade(
        req.body,
        empresaId.toString()
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
      Log.error('[AluguelController] Erro ao verificar disponibilidade', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao verificar disponibilidade',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}
