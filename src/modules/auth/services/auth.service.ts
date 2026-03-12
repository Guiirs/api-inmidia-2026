/**
 * Auth Service - Lógica de negócio com JWT
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
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

  private async generateRefreshToken(): Promise<{ token: string; hashed: string }> {
    // random opaque string
    const token = crypto.randomBytes(32).toString('hex');
    // store hashed version for security
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(token, salt);
    return { token, hashed };
  }

  private async isRefreshTokenValid(user: IUser, providedToken: string): Promise<boolean> {
    if (!user.refreshToken || !user.refreshTokenExpiry) return false;
    if (user.refreshTokenExpiry < new Date()) return false;
    const match = await bcrypt.compare(providedToken, user.refreshToken);
    return match;
  }

  /**
   * Login do usuário
   */
  async login(input: LoginInput): Promise<Result<LoginResponse & { refreshToken: string }, InvalidCredentialsError | NotFoundError>> {
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

      // Refresh token
      const { token: refreshToken, hashed } = await this.generateRefreshToken();
      const expiryDate = new Date(Date.now() + this.parseDuration(config.jwtRefreshExpiresIn));
      await this.repository.saveRefreshToken(user._id.toString(), hashed, expiryDate);

      // Resposta
      const response: LoginResponse & { refreshToken: string } = {
        token,
        refreshToken,
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

  /**
   * Tenta renovar o token de acesso a partir de um refresh token válido.
   */
  async refreshToken(oldRefresh: string): Promise<Result<{ token: string; refreshToken: string }, InvalidCredentialsError>> {
    try {
      const userRes = await this.repository.findByRefreshToken(oldRefresh);
      if (userRes.isFailure || !userRes.value) {
        return Result.fail(new InvalidCredentialsError());
      }
      const user = userRes.value;

      const valid = await this.isRefreshTokenValid(user, oldRefresh);
      if (!valid) {
        return Result.fail(new InvalidCredentialsError());
      }

      // gerar novo access token
      const payload: JwtPayload = {
        id: user._id.toString(),
        empresaId: (user.empresa || user.empresaId).toString(),
        role: user.role,
        username: user.username,
        email: user.email,
      };
      const token = this.generateToken(payload);

      // rotate refresh token
      const { token: refreshToken, hashed: newHash } = await this.generateRefreshToken();
      const expiryDate = new Date(Date.now() + this.parseDuration(config.jwtRefreshExpiresIn));
      await this.repository.saveRefreshToken(user._id.toString(), newHash, expiryDate);

      return Result.ok({ token, refreshToken });
    } catch {
      return Result.fail(new InvalidCredentialsError());
    }
  }
}
