/**
 * Empresa Controller
 * Camada HTTP com Result pattern
 */

import { Request, Response } from 'express';
import { Log } from '@shared/core';
import { getErrorStatusCode } from '@shared/core';
import type { EmpresaService } from './services/empresa.service';
import type { IAuthRequest } from '../../types/express';

export class EmpresaController {
  
  constructor(private readonly service: EmpresaService) {}

  /**
   * GET /empresas/api-key
   * Busca API Key da empresa
   */
  getApiKey = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.service.getApiKey(empresaId.toString());

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
        data: { apiKey: result.value }
      });

    } catch (error) {
      Log.error('[EmpresaController] Erro ao buscar API Key', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao buscar API Key',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * POST /empresas/api-key/regenerate
   * Regenera API Key da empresa
   */
  regenerateApiKey = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.service.regenerateApiKey(empresaId.toString());

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
        message: 'API Key regenerada com sucesso',
        data: { apiKey: result.value }
      });

    } catch (error) {
      Log.error('[EmpresaController] Erro ao regenerar API Key', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao regenerar API Key',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * GET /empresas/details
   * Busca detalhes da empresa com cache
   */
  getEmpresaDetails = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.service.getEmpresaDetails(empresaId.toString());

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
      Log.error('[EmpresaController] Erro ao buscar detalhes da empresa', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao buscar detalhes',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * PATCH /empresas/details
   * Atualiza detalhes da empresa
   */
  updateEmpresaDetails = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.service.updateEmpresaDetails(
        empresaId.toString(),
        req.body
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
        message: 'Empresa atualizada com sucesso',
        data: result.value
      });

    } catch (error) {
      Log.error('[EmpresaController] Erro ao atualizar empresa', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao atualizar empresa',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * POST /empresas/register
   * Registra uma nova empresa com usuário admin
   */
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.service.registerEmpresa(req.body, req.body);

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
        message: 'Empresa registada com sucesso',
        data: result.value
      });

    } catch (error) {
      Log.error('[EmpresaController] Erro ao registar empresa', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao registar empresa',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}


