/**
 * User Controller
 * HTTP layer with Result pattern
 */

import { Request, Response } from 'express';
import { Log } from '@shared/core';
import { getErrorStatusCode } from '@shared/core';
import type { UserService } from '../services/user.service';
import type { IAuthRequest } from '../../../types/express';

export class UserController {
  constructor(private readonly service: UserService) {}

  /**
   * GET /user/profile
   * Busca perfil do usuario autenticado
   */
  getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const userId = authReq.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuario nao autenticado',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const result = await this.service.getUserProfile(userId.toString());

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
      Log.error('[UserController] Erro ao buscar perfil', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao buscar perfil',
        code: 'INTERNAL_ERROR',
      });
    }
  };

  /**
   * PATCH|PUT /user/profile
   * Atualiza perfil do usuario autenticado
   */
  updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const userId = authReq.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuario nao autenticado',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const result = await this.service.updateProfile(userId.toString(), req.body);

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
        message: 'Perfil atualizado com sucesso',
        data: result.value,
      });
    } catch (error) {
      Log.error('[UserController] Erro ao atualizar perfil', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao atualizar perfil',
        code: 'INTERNAL_ERROR',
      });
    }
  };

  /**
   * GET /user/me/empresa
   * Busca perfil da empresa do usuario autenticado
   */
  getEmpresaProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const empresaId = authReq.user?.empresaId;
      const role = authReq.user?.role;

      if (!empresaId || !role) {
        res.status(401).json({
          success: false,
          error: 'Usuario nao autenticado',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const result = await this.service.getEmpresaProfile(empresaId.toString(), String(role));
      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code,
        });
        return;
      }

      res.status(200).json(result.value);
    } catch (error) {
      Log.error('[UserController] Erro ao buscar perfil da empresa', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao buscar perfil da empresa',
        code: 'INTERNAL_ERROR',
      });
    }
  };

  /**
   * POST /user/me/empresa/regenerate-api-key
   * Regenera API key da empresa
   */
  regenerateEmpresaApiKey = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const userId = authReq.user?.id;
      const empresaId = authReq.user?.empresaId;
      const role = authReq.user?.role;
      const password = String(req.body?.password || '');

      if (!userId || !empresaId || !role) {
        res.status(401).json({
          success: false,
          error: 'Usuario nao autenticado',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const auditData = {
        ip_address: req.ip || req.connection?.remoteAddress,
        user_agent: req.get('user-agent') || '',
      };

      const result = await this.service.regenerateApiKey(
        userId.toString(),
        empresaId.toString(),
        String(role),
        password,
        auditData
      );

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
        message: 'API Key regenerada com sucesso! Guarde-a num local seguro.',
        fullApiKey: result.value.fullApiKey,
        newApiKeyPrefix: result.value.newPrefix,
      });
    } catch (error) {
      Log.error('[UserController] Erro ao regenerar API key da empresa', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao regenerar API key',
        code: 'INTERNAL_ERROR',
      });
    }
  };
}
