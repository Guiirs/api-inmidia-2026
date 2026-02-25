/**
 * Auth Controller - Camada HTTP
 */

import { Request, Response } from 'express';
import { Log } from '@shared/core';
import { getErrorStatusCode } from '@shared/core';
import type { AuthService } from '../services/auth.service';
import type { IAuthRequest } from '../../../types/express';

export class AuthController {
  
  constructor(private readonly service: AuthService) {}

  /**
   * POST /auth/login
   * Login do usuário
   */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.service.login(req.body);

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
      Log.error('[AuthController] Erro ao fazer login', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao fazer login',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * POST /auth/change-password
   * Altera senha do usuário autenticado
   */
  changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const userId = authReq.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const result = await this.service.changePassword(
        userId.toString(),
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
        data: result.value
      });

    } catch (error) {
      Log.error('[AuthController] Erro ao alterar senha', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao alterar senha',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * POST /auth/forgot-password
   * Solicita reset de senha
   */
  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          error: 'Email é obrigatório',
          code: 'REQUIRED_FIELD'
        });
        return;
      }

      await this.service.requestPasswordReset(email);

      // Sempre retorna sucesso por segurança
      res.status(200).json({
        success: true,
        message: 'Se o email estiver registrado, receberá instruções para redefinir a senha'
      });

    } catch (error) {
      Log.error('[AuthController] Erro ao solicitar reset de senha', { error });
      // Não revelar erro por segurança
      res.status(200).json({
        success: true,
        message: 'Se o email estiver registrado, receberá instruções para redefinir a senha'
      });
    }
  };

  /**
   * POST /auth/reset-password/:token
   * Reseta senha com token
   */
  resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params;
      const { newPassword } = req.body;

      if (!token) {
        res.status(400).json({
          success: false,
          error: 'Token é obrigatório',
          code: 'REQUIRED_FIELD'
        });
        return;
      }

      if (!newPassword) {
        res.status(400).json({
          success: false,
          error: 'Nova senha é obrigatória',
          code: 'REQUIRED_FIELD'
        });
        return;
      }

      const result = await this.service.resetPasswordWithToken(token, newPassword);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: 'Token inválido ou expirado',
          code: result.error.code
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Senha redefinida com sucesso'
      });

    } catch (error) {
      Log.error('[AuthController] Erro ao resetar senha', { error });
      res.status(400).json({
        success: false,
        error: 'Token inválido ou expirado',
        code: 'INVALID_TOKEN'
      });
    }
  };

  /**
   * GET /auth/verify-token/:token
   * Verifica validade do token de reset
   */
  verifyResetToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params;

      if (!token) {
        res.status(400).json({
          success: false,
          error: 'Token é obrigatório',
          code: 'REQUIRED_FIELD'
        });
        return;
      }

      const result = await this.service.verifyPasswordResetToken(token);

      if (result.isFailure) {
        res.status(400).json({
          success: false,
          error: 'Token inválido ou expirado',
          code: result.error.code
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Token válido'
      });

    } catch (error) {
      Log.error('[AuthController] Erro ao verificar token', { error });
      res.status(400).json({
        success: false,
        error: 'Token inválido ou expirado',
        code: 'INVALID_TOKEN'
      });
    }
  };
}
