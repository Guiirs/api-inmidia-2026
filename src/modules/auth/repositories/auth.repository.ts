/**
 * Auth Repository - Camada de acesso a dados
 */

import { Model } from 'mongoose';
import bcrypt from 'bcrypt';
import { Result, InvalidCredentialsError, NotFoundError } from '@shared/core';
import type { IUser } from '../../../types/models';

export interface IAuthRepository {
  /**
   * Busca usuário por username ou email (com senha)
   */
  findByUsernameOrEmail(usernameOrEmail: string): Promise<Result<IUser | null, NotFoundError>>;

  /**
   * Busca usuário por ID (com senha)
   */
  findByIdWithPassword(id: string): Promise<Result<IUser | null, NotFoundError>>;

  /**
   * Busca usuário por email
   */
  findByEmail(email: string): Promise<Result<IUser | null, NotFoundError>>;

  /**
   * Verifica senha do usuário
   */
  verifyPassword(hashedPassword: string, plainPassword: string): Promise<Result<boolean, InvalidCredentialsError>>;

  /**
   * Atualiza senha do usuário
   */
  updatePassword(userId: string, newPassword: string): Promise<Result<void, NotFoundError>>;

  /**
   * Armazena refresh token (hash) e sua expiração
   */
  saveRefreshToken(userId: string, hashedToken: string, expiresAt: Date): Promise<Result<void, NotFoundError>>;

  /**
   * Busca usuário por hash de refresh token (seleciona também campos escondidos)
   */
  findByRefreshToken(hashedToken: string): Promise<Result<IUser | null, NotFoundError>>;

  /**
   * Limpa o refresh token de um usuário (logout/rotacao)
   */
  clearRefreshToken(userId: string): Promise<Result<void, NotFoundError>>;
}

export class AuthRepository implements IAuthRepository {
  constructor(private readonly model: Model<IUser>) {}

  async findByUsernameOrEmail(usernameOrEmail: string): Promise<Result<IUser | null, NotFoundError>> {
    try {
      const user = await this.model
        .findOne({
          $or: [
            { username: usernameOrEmail },
            { email: usernameOrEmail.toLowerCase() }
          ]
        })
        .select('+senha +password')
        .lean<IUser | null>()
        .exec();

      return Result.ok(user);
    } catch {
      return Result.fail(
        new NotFoundError('Usuário', usernameOrEmail)
      );
    }
  }

  async findByIdWithPassword(id: string): Promise<Result<IUser | null, NotFoundError>> {
    try {
      const user = await this.model
        .findById(id)
        .select('+senha +password')
        .exec();

      return Result.ok(user);
    } catch {
      return Result.fail(
        new NotFoundError('Usuário', id)
      );
    }
  }

  async findByEmail(email: string): Promise<Result<IUser | null, NotFoundError>> {
    try {
      const user = await this.model
        .findOne({ email: email.toLowerCase() })
        .lean<IUser | null>()
        .exec();

      return Result.ok(user);
    } catch {
      return Result.fail(
        new NotFoundError('Usuário', email)
      );
    }
  }

  async verifyPassword(hashedPassword: string, plainPassword: string): Promise<Result<boolean, InvalidCredentialsError>> {
    try {
      const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
      return Result.ok(isMatch);
    } catch {
      return Result.fail(new InvalidCredentialsError());
    }
  }

  async updatePassword(userId: string, newPassword: string): Promise<Result<void, NotFoundError>> {
    try {
      const user = await this.model.findById(userId).exec();

      if (!user) {
        return Result.fail(new NotFoundError('Usuário', userId));
      }

      // Password será hasheado pelo pre-save hook
      if (user.senha !== undefined) {
        user.senha = newPassword;
      } else {
        user.password = newPassword;
      }
      
      await user.save();
      return Result.ok(undefined);
    } catch {
      return Result.fail(new NotFoundError('Usuário', userId));
    }
  }

  async saveRefreshToken(userId: string, hashedToken: string, expiresAt: Date): Promise<Result<void, NotFoundError>> {
    try {
      const user = await this.model.findById(userId).exec();
      if (!user) {
        return Result.fail(new NotFoundError('Usuário', userId));
      }
      user.refreshToken = hashedToken;
      user.refreshTokenExpiry = expiresAt;
      await user.save();
      return Result.ok(undefined);
    } catch {
      return Result.fail(new NotFoundError('Usuário', userId));
    }
  }

  async findByRefreshToken(hashedToken: string): Promise<Result<IUser | null, NotFoundError>> {
    try {
      const user = await this.model
        .findOne({ refreshToken: hashedToken })
        .select('+refreshToken +refreshTokenExpiry')
        .exec();
      return Result.ok(user);
    } catch {
      return Result.fail(new NotFoundError('Usuário com refresh token', hashedToken));
    }
  }

  async clearRefreshToken(userId: string): Promise<Result<void, NotFoundError>> {
    try {
      const user = await this.model.findById(userId).exec();
      if (!user) {
        return Result.fail(new NotFoundError('Usuário', userId));
      }
      user.refreshToken = undefined;
      user.refreshTokenExpiry = undefined;
      await user.save();
      return Result.ok(undefined);
    } catch {
      return Result.fail(new NotFoundError('Usuário', userId));
    }
  }
}
