import { Result } from '@shared/core/Result';
import { DomainError, NotFoundError, ValidationError } from '@shared/core/DomainError';
import Placa from '@modules/placas/Placa';
import Cliente from '@modules/clientes/Cliente';
import { PublicPlacaInfo, RegisterPlacaInput } from '../dtos/public-api.dto';

interface PublicPlacaDoc {
  numero_placa?: string;
  status?: string;
  localizacao?: string;
  updatedAt?: Date;
  clienteId?: string;
}

interface PublicClienteDoc {
  nome?: string;
  email?: string;
  telefone?: string;
}

/**
 * Repository para Public API
 */
export class PublicApiRepository {
  private parseAllowedApiKeys(): string[] {
    const raw = process.env.PUBLIC_API_KEYS || process.env.INMIDIA_PUBLIC_API_KEYS || '';
    return raw
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }

  /**
   * Buscar informacoes de uma placa
   */
  async getPlacaInfo(placa: string, apiKey: string): Promise<Result<PublicPlacaInfo, DomainError>> {
    try {
      const apiKeyValidation = await this.validateApiKey(apiKey);
      if (apiKeyValidation.isFailure || !apiKeyValidation.value) {
        return Result.fail(new ValidationError([{ field: 'apiKey', message: 'API key invalida' }]));
      }

      const placaDoc = await Placa.findOne({ numero_placa: placa }).lean();

      if (!placaDoc) {
        return Result.fail(new NotFoundError('Placa', placa));
      }

      const placaData = placaDoc as PublicPlacaDoc;
      let clienteInfo = null;
      if (placaData.clienteId) {
        const clienteDoc = await Cliente.findById(placaData.clienteId).lean();
        if (clienteDoc) {
          const clienteData = clienteDoc as PublicClienteDoc;
          clienteInfo = {
            nome: clienteData.nome || '',
            email: clienteData.email || '',
            telefone: clienteData.telefone || '',
          };
        }
      }

      const result: PublicPlacaInfo = {
        placa: placaData.numero_placa || placa,
        status: placaData.status || 'disponivel',
        localizacao: placaData.localizacao || 'Nao informada',
        ultimaAtualizacao: placaData.updatedAt || new Date(),
        cliente: clienteInfo,
      };

      return Result.ok(result);
    } catch {
      return Result.fail(
        new ValidationError([
          {
            field: 'geral',
            message: 'Erro ao buscar informacoes da placa',
          },
        ])
      );
    }
  }

  /**
   * Registrar nova placa via API publica
   */
  async registerPlaca(data: RegisterPlacaInput, apiKey: string): Promise<Result<PublicPlacaInfo, DomainError>> {
    try {
      const apiKeyValidation = await this.validateApiKey(apiKey);
      if (apiKeyValidation.isFailure || !apiKeyValidation.value) {
        return Result.fail(new ValidationError([{ field: 'apiKey', message: 'API key invalida' }]));
      }

      const existing = await Placa.findOne({ numero_placa: data.placa }).lean();
      if (existing) {
        return Result.fail(new ValidationError([{ field: 'placa', message: 'Placa ja cadastrada' }]));
      }

      const newPlaca = new Placa({
        numero_placa: data.placa,
        status: 'disponivel',
        localizacao: data.localizacao || 'Nao informada',
        observacoes: data.observacoes || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await newPlaca.save();

      const result: PublicPlacaInfo = {
        placa: data.placa,
        status: 'disponivel',
        localizacao: data.localizacao || 'Nao informada',
        ultimaAtualizacao: new Date(),
        cliente: null,
      };

      return Result.ok(result);
    } catch {
      return Result.fail(
        new ValidationError([
          {
            field: 'geral',
            message: 'Erro ao registrar placa',
          },
        ])
      );
    }
  }

  /**
   * Verificar disponibilidade de uma placa
   */
  async checkAvailability(placa: string, apiKey: string): Promise<Result<{ disponivel: boolean }, DomainError>> {
    try {
      const apiKeyValidation = await this.validateApiKey(apiKey);
      if (apiKeyValidation.isFailure || !apiKeyValidation.value) {
        return Result.fail(new ValidationError([{ field: 'apiKey', message: 'API key invalida' }]));
      }

      const placaDoc = await Placa.findOne({ numero_placa: placa }).lean();

      if (!placaDoc) {
        return Result.ok({ disponivel: false });
      }

      const placaData = placaDoc as PublicPlacaDoc;
      const disponivel = placaData.status === 'disponivel';

      return Result.ok({ disponivel });
    } catch {
      return Result.fail(
        new ValidationError([
          {
            field: 'geral',
            message: 'Erro ao verificar disponibilidade',
          },
        ])
      );
    }
  }

  /**
   * Validar API key
   */
  async validateApiKey(apiKey: string): Promise<Result<boolean, DomainError>> {
    try {
      if (!apiKey || apiKey.length < 20) {
        return Result.ok(false);
      }

      const allowedApiKeys = this.parseAllowedApiKeys();

      // Backward compatibility: if no allowlist configured, keep old behavior.
      if (allowedApiKeys.length === 0) {
        return Result.ok(true);
      }

      return Result.ok(allowedApiKeys.includes(apiKey));
    } catch {
      return Result.fail(
        new ValidationError([
          {
            field: 'geral',
            message: 'Erro ao validar API key',
          },
        ])
      );
    }
  }
}
