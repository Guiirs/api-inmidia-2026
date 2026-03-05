/**
 * Auth Service - Lógica de negócio com JWT
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import { Result, InvalidCredentialsError, NotFoundError, BusinessRuleViolationError } from '@shared/core';
import config from '@config/config';
import emailService from '@shared/container/email.service';
import type { IAuthRepository } from '../repositories/auth.repository';
import type {
  LoginInput,
  ChangePasswordInput,
  LoginResponse,
  ChangePasswordResponse,
  JwtPayload,
} from '../dtos/auth.dto';

export class AuthService {
  constructor(private readonly repository: IAuthRepository) {}

  /**
   * Gera token JWT
   */
  private generateToken(payload: JwtPayload): string {
    const options: SignOptions = {
      expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
    };
    
    return jwt.sign(
      payload,
      config.jwtSecret,
      options
    );
  }

  /**
   * Login do usuário
   */
  async login(input: LoginInput): Promise<Result<LoginResponse, InvalidCredentialsError | NotFoundError>> {
    try {
      // Busca usuário
      const userResult = await this.repository.findByUsernameOrEmail(input.usernameOrEmail);

      if (userResult.isFailure || !userResult.value) {
        return Result.fail(new InvalidCredentialsError());
      }

      const user = userResult.value;

      // Verifica senha
      const senhaHash = user.senha || user.password;
      if (!senhaHash) {
        return Result.fail(new InvalidCredentialsError());
      }

      const passwordResult = await this.repository.verifyPassword(senhaHash, input.password);

      if (passwordResult.isFailure || !passwordResult.value) {
        return Result.fail(new InvalidCredentialsError());
      }

      // Gera token
      const payload: JwtPayload = {
        id: user._id.toString(),
        empresaId: (user.empresa || user.empresaId).toString(),
        role: user.role,
        username: user.username,
        email: user.email,
      };

      const token = this.generateToken(payload);

      // Resposta
      const response: LoginResponse = {
        token,
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          nome: user.nome,
          telefone: user.telefone,
          role: user.role,
          empresaId: (user.empresa || user.empresaId).toString(),
          createdAt: user.createdAt,
        },
      };

      return Result.ok(response);
    } catch {
      return Result.fail(new InvalidCredentialsError());
    }
  }

  /**
   * Altera senha do usuário
   */
  async changePassword(
    userId: string,
    input: ChangePasswordInput
  ): Promise<Result<ChangePasswordResponse, InvalidCredentialsError | NotFoundError | BusinessRuleViolationError>> {
    try {
      // Busca usuário com senha
      const userResult = await this.repository.findByIdWithPassword(userId);

      if (userResult.isFailure || !userResult.value) {
        return Result.fail(new NotFoundError('Usuário', userId));
      }

      const user = userResult.value;

      // Verifica senha antiga
      const senhaHash = user.senha || user.password;
      if (!senhaHash) {
        return Result.fail(new InvalidCredentialsError());
      }

      const passwordResult = await this.repository.verifyPassword(senhaHash, input.oldPassword);

      if (passwordResult.isFailure || !passwordResult.value) {
        return Result.fail(
          new BusinessRuleViolationError('Senha atual incorreta')
        );
      }

      // Atualiza senha
      const updateResult = await this.repository.updatePassword(userId, input.newPassword);

      if (updateResult.isFailure) {
        return Result.fail(updateResult.error);
      }

      return Result.ok({ message: 'Senha alterada com sucesso' });
    } catch {
      return Result.fail(new NotFoundError('Usuário', userId));
    }
  }

  /**
   * Solicita reset de senha (envia email)
   */
  async requestPasswordReset(email: string): Promise<Result<void, NotFoundError>> {
    try {
      const userResult = await this.repository.findByEmail(email);

      // Por segurança, não revelar se email existe
      if (userResult.isFailure || !userResult.value) {
        // Log interno mas retorna sucesso para usuário
        return Result.ok(undefined);
      }

      const user = userResult.value;
      const expiresInMinutes = parseInt(process.env.PASSWORD_RESET_EXPIRES_MINUTES || '30', 10);
      const resetPayload: JwtPayload = {
        id: user._id.toString(),
        empresaId: (user.empresa || user.empresaId).toString(),
        role: (user.role || 'user') as JwtPayload['role'],
        username: user.username || user.email || 'user',
        email: (user.email || email).toLowerCase(),
      };

      const token = jwt.sign(resetPayload, config.jwtSecret, {
        expiresIn: `${expiresInMinutes}m`,
      });

      const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';
      const baseUrl = frontendUrl.replace(/\/+$/, '');
      const resetUrl = `${baseUrl}/reset-password/${token}`;

      await emailService.sendPasswordResetEmail({
        email: resetPayload.email,
        resetUrl,
        expiresIn: expiresInMinutes,
      });

      return Result.ok(undefined);
    } catch {
      return Result.ok(undefined); // Não revelar erro
    }
  }

  /**
   * Reseta senha com token
   */
  async resetPasswordWithToken(
    token: string,
    newPassword: string
  ): Promise<Result<void, InvalidCredentialsError | NotFoundError>> {
    try {
      // Verifica token
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

      // Atualiza senha
      const updateResult = await this.repository.updatePassword(decoded.id, newPassword);

      if (updateResult.isFailure) {
        return Result.fail(new InvalidCredentialsError());
      }

      return Result.ok(undefined);
    } catch {
      return Result.fail(new InvalidCredentialsError());
    }
  }

  /**
   * Verifica validade do token de reset
   */
  async verifyPasswordResetToken(token: string): Promise<Result<void, InvalidCredentialsError>> {
    try {
      jwt.verify(token, config.jwtSecret);
      return Result.ok(undefined);
    } catch {
      return Result.fail(new InvalidCredentialsError());
    }
  }
}
