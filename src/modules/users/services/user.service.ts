/**
 * User Service - business logic
 */

import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { Types } from 'mongoose';
import { Result, NotFoundError, ValidationError } from '@shared/core';
import type { DomainError } from '@shared/core';
import { ZodError } from 'zod';
import Empresa from '@modules/empresas/Empresa';
import type { IUserRepository } from '../repositories/user.repository';
import type {
  UpdateUserProfileInput,
  UserProfileResponse,
} from '../dtos/user.dto';

interface EmpresaProfileResponse {
  nome: string;
  api_key_prefix?: string;
  status_assinatura?: string;
}

interface RegenerateApiKeyResponse {
  fullApiKey: string;
  newPrefix: string;
}

export class UserService {
  constructor(private readonly repository: IUserRepository) {}

  private isAdminRole(userRole: string): boolean {
    const normalizedRole = String(userRole || '').trim().toLowerCase();
    return normalizedRole === 'admin' || normalizedRole === 'superadmin';
  }

  /**
   * Busca perfil do usuario
   */
  async getUserProfile(userId: string): Promise<Result<UserProfileResponse, NotFoundError>> {
    try {
      const result = await this.repository.findById(userId);

      if (result.isFailure) {
        return Result.fail(result.error as NotFoundError);
      }

      if (!result.value) {
        return Result.fail(new NotFoundError('Usuario', userId));
      }

      const profile: UserProfileResponse = {
        username: result.value.username,
        email: result.value.email,
        nome: result.value.nome,
        telefone: result.value.telefone,
      };

      return Result.ok(profile);
    } catch (error: any) {
      return Result.fail(new NotFoundError('Usuario', userId));
    }
  }

  /**
   * Atualiza perfil do usuario
   */
  async updateProfile(
    userId: string,
    updateData: UpdateUserProfileInput
  ): Promise<Result<UserProfileResponse, NotFoundError | ValidationError>> {
    try {
      if (Object.keys(updateData).length === 0) {
        return await this.getUserProfile(userId);
      }

      const result = await this.repository.updateProfile(userId, updateData);

      if (result.isFailure) {
        return Result.fail(result.error as ValidationError | NotFoundError);
      }

      const profile: UserProfileResponse = {
        username: result.value.username,
        email: result.value.email,
        nome: result.value.nome,
        telefone: result.value.telefone,
      };

      return Result.ok(profile);
    } catch (error: any) {
      if (error instanceof ZodError) {
        const validationErrors = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return Result.fail(new ValidationError(validationErrors));
      }
      return Result.fail(new NotFoundError('Usuario', userId));
    }
  }

  /**
   * Busca perfil da empresa associada ao usuario (apenas admin/superadmin)
   */
  async getEmpresaProfile(
    empresaId: string,
    userRole: string
  ): Promise<Result<EmpresaProfileResponse, DomainError>> {
    try {
      if (!this.isAdminRole(userRole)) {
        return Result.fail(
          new ValidationError([{ field: 'role', message: 'Apenas administradores podem aceder aos detalhes da empresa.' }])
        );
      }

      const empresa = await Empresa.findById(empresaId)
        .select('nome api_key_prefix status_assinatura')
        .lean()
        .exec();

      if (!empresa) {
        return Result.fail(new NotFoundError('Empresa', empresaId));
      }

      return Result.ok({
        nome: empresa.nome,
        api_key_prefix: empresa.api_key_prefix,
        status_assinatura: (empresa as unknown as { status_assinatura?: string }).status_assinatura,
      });
    } catch (error) {
      return Result.fail(
        new ValidationError([{ field: 'empresaId', message: 'Erro ao buscar perfil da empresa' }])
      );
    }
  }

  /**
   * Regenera API key da empresa (apenas admin/superadmin)
   */
  async regenerateApiKey(
    userId: string,
    empresaId: string,
    userRole: string,
    userPassword: string,
    auditData: { ip_address?: string; user_agent?: string } = {}
  ): Promise<Result<RegenerateApiKeyResponse, DomainError>> {
    try {
      if (!this.isAdminRole(userRole)) {
        return Result.fail(
          new ValidationError([{ field: 'role', message: 'Apenas administradores podem regenerar a chave de API.' }])
        );
      }

      if (!userPassword) {
        return Result.fail(
          new ValidationError([{ field: 'password', message: 'A senha atual e obrigatoria para regenerar a chave.' }])
        );
      }

      const userResult = await this.repository.findById(userId, true);
      if (userResult.isFailure) {
        return Result.fail(userResult.error);
      }

      if (!userResult.value) {
        return Result.fail(new NotFoundError('Usuario', userId));
      }

      const user = userResult.value;
      const userEmpresa = String(user.empresaId || user.empresa || '');
      if (userEmpresa !== String(empresaId)) {
        return Result.fail(new NotFoundError('Usuario administrador para esta empresa', userId));
      }

      const passwordHash = user.senha || user.password;
      if (!passwordHash) {
        return Result.fail(
          new ValidationError([{ field: 'password', message: 'Hash de senha nao encontrado para o usuario.' }])
        );
      }

      const passwordMatch = await bcrypt.compare(userPassword, passwordHash);
      if (!passwordMatch) {
        return Result.fail(
          new ValidationError([{ field: 'password', message: 'Senha incorreta. Verificacao falhou.' }])
        );
      }

      const empresa = await Empresa.findById(empresaId).exec();
      if (!empresa) {
        return Result.fail(new NotFoundError('Empresa', empresaId));
      }

      const prefixBase = empresa.nome.substring(0, 4).toLowerCase().replace(/[^a-z]/g, '') || 'emp';
      const uuidPrefix = uuidv4().split('-')[0] || 'key0';
      const newApiKeyPrefix = `${prefixBase}_${uuidPrefix.substring(0, 4)}`;
      const newApiKeySecret = uuidv4();
      const newApiKeyHash = await bcrypt.hash(newApiKeySecret, 10);
      const newFullApiKey = `${newApiKeyPrefix}_${newApiKeySecret}`;

      empresa.api_key_hash = newApiKeyHash;
      empresa.api_key_prefix = newApiKeyPrefix;
      empresa.api_key_history = empresa.api_key_history || [];
      empresa.api_key_history.push({
        regenerated_by: new Types.ObjectId(userId),
        regenerated_at: new Date(),
        ip_address: auditData.ip_address || '',
        user_agent: auditData.user_agent || '',
      });

      await empresa.save();

      return Result.ok({
        fullApiKey: newFullApiKey,
        newPrefix: newApiKeyPrefix,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        const validationErrors = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return Result.fail(new ValidationError(validationErrors));
      }

      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao regenerar API key' }])
      );
    }
  }
}
