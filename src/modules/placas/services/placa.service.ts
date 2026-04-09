/**
 * Placa Service
 * Camada de lógica de negócios com Result Pattern
 */

import path from 'path';
import { Result, DomainError } from '@shared/core';
import {
  PlacaNotFoundError,
  ValidationError,
  NotFoundError,
  toDomainError
} from '@shared/core';
import { Log } from '@shared/core';
import { safeDeleteFromR2 } from '@shared/infra/http/middlewares/upload.middleware';
import Aluguel from '@modules/alugueis/Aluguel';
import Regiao from '@modules/regioes/Regiao';
import type { IPlacaRepository } from '../repositories/placa.repository';
import {
  validateCreatePlaca,
  validateUpdatePlaca,
  validateListQuery,
  validatePlacaImage,
  toListItems,
  type PlacaEntity,
  type PaginatedPlacasResponse,
  type CreatePlacaDTO,
  type UpdatePlacaDTO
} from '../dtos/placa.dto';
import { getProximoNumeroRegiao, getProximoNumeroGlobal, reorganizarPlacas } from '@utils/numeracao';

interface S3File {
  key: string;
  location: string;
  bucket: string;
  mimetype: string;
  originalname: string;
  size: number;
}

type PersistencePayload = Record<string, unknown> & {
  imagem?: string | null;
  regiao?: string;
  regiaoId?: string;
  localizacao?: string | null;
  nomeDaRua?: string | null;
  coordenadas?: string | { latitude?: number; longitude?: number } | null;
  ativa?: boolean;
  disponivel?: boolean;
};

export class PlacaService {
  constructor(private readonly repository: IPlacaRepository) {}

  /**
   * Cria nova placa
   */
  async createPlaca(
    data: unknown,
    file: S3File | undefined,
    empresaIdParam: string
  ): Promise<Result<PlacaEntity, DomainError>> {
    try {
      const normalizedInput = this.normalizeIncomingPayload(data);
      // Validar dados de entrada
      const validatedData = validateCreatePlaca(normalizedInput);
      const persistenceData = this.normalizeForPersistence(validatedData);

      // Validar região
      const regiaoExists = await Regiao.findOne({ 
        _id: persistenceData.regiaoId, 
        empresaId: empresaIdParam
      }).lean();

      if (!regiaoExists) {
        return Result.fail(
          new NotFoundError('Região', persistenceData.regiaoId)
        );
      }

      // Calcular numeração
      const cidade = persistenceData.cidade || regiaoExists.nome;
      if (!cidade) {
        return Result.fail(
          new ValidationError([
            { field: 'cidade', message: 'Cidade é obrigatória para numeração' }
          ])
        );
      }
      const empresaIdStr = empresaIdParam as any;
      const numeroRegiao = await getProximoNumeroRegiao(cidade as string, empresaIdStr);
      const numeroGlobal = await getProximoNumeroGlobal(empresaIdStr);

      persistenceData.numero_regiao = numeroRegiao;
      persistenceData.numero_global = numeroGlobal;
      persistenceData.cidade = cidade;

      // Validar arquivo se fornecido
      if (file) {
        validatePlacaImage({
          mimetype: file.mimetype,
          size: file.size,
          filename: file.originalname
        });

        Log.info('[PlacaService] Arquivo validado para imagem', {
          filename: file.originalname,
          empresaId: empresaIdParam
        });

        persistenceData.imagem = path.basename(file.key);
      }

      // Criar placa via repository
      const result = await this.repository.create(persistenceData as CreatePlacaDTO, empresaIdParam);

      if (result.isFailure) {
        return Result.fail(result.error);
      }

      Log.info('[PlacaService] Placa criada com sucesso', {
        placaId: result.value._id,
        numeroPlaca: result.value.numero_placa,
        empresaId: empresaIdParam
      });

      return Result.ok(result.value);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(
          new ValidationError(
            [{ field: 'data', message: 'Dados de entrada inválidos' }]
          )
        );
      }

      const domainError = toDomainError(error);
      Log.error('[PlacaService] Erro ao criar placa', {
        error: domainError.message,
        empresaId: empresaIdParam
      });

      return Result.fail(domainError);
    }
  }

  /**
   * Atualiza placa existente
   */
  async updatePlaca(
    id: string,
    data: unknown,
    file: S3File | undefined,
    empresaId: string
  ): Promise<Result<PlacaEntity, DomainError>> {
    try {
      const normalizedInput = this.normalizeIncomingPayload(data);
      // Validar dados de entrada
      const validatedData = validateUpdatePlaca(normalizedInput);
      const persistenceData = this.normalizeForPersistence(validatedData);

      // Buscar placa existente
      const existsResult = await this.repository.findById(id, empresaId);
      if (existsResult.isFailure) {
        return Result.fail(existsResult.error);
      }

      const placaExistente = existsResult.value;
      if (!placaExistente) {
        return Result.fail(new PlacaNotFoundError(id));
      }

      // Validar região se foi alterada
      if (persistenceData.regiaoId) {
        const regiaoExists = await Regiao.findOne({ 
          _id: persistenceData.regiaoId, 
          empresaId 
        }).lean();

        if (!regiaoExists) {
          return Result.fail(
            new NotFoundError('Região', persistenceData.regiaoId)
          );
        }
      }

      // Processar imagem
      if (file) {
        // Validar novo arquivo
        validatePlacaImage({
          mimetype: file.mimetype,
          size: file.size,
          filename: file.originalname
        });

        persistenceData.imagem = path.basename(file.key);

        // Apagar imagem antiga se existir
        if (placaExistente.imagem) {
          const oldKey = `placas/${placaExistente.imagem}`;
          try {
            await safeDeleteFromR2(oldKey);
            Log.info('[PlacaService] Imagem antiga removida', { key: oldKey });
          } catch (deleteError) {
            Log.warn('[PlacaService] Falha ao remover imagem antiga', {
              key: oldKey,
              error: toDomainError(deleteError).message
            });
          }
        }
      } else if ('imagem' in persistenceData && persistenceData.imagem === null) {
        // Remover imagem explicitamente
        if (placaExistente.imagem) {
          const imagemKey = `placas/${placaExistente.imagem}`;
          try {
            await safeDeleteFromR2(imagemKey);
            Log.info('[PlacaService] Imagem removida', { key: imagemKey });
          } catch (deleteError) {
            Log.warn('[PlacaService] Falha ao remover imagem', {
              key: imagemKey,
              error: toDomainError(deleteError).message
            });
          }
        }
        persistenceData.imagem = undefined;
      }

      // Atualizar via repository
      const result = await this.repository.update(id, persistenceData as UpdatePlacaDTO, empresaId);

      if (result.isFailure) {
        return Result.fail(result.error);
      }

      // Verificar se cidade ou região mudou e reorganizar numeração
      const cidadeMudou = persistenceData.cidade && persistenceData.cidade !== placaExistente.cidade;
      const regiaoMudou = persistenceData.regiaoId && 
        persistenceData.regiaoId.toString() !== placaExistente.regiaoId.toString();

      if (cidadeMudou || regiaoMudou) {
        try {
          await reorganizarPlacas(empresaId);
          Log.info('[PlacaService] Numeração reorganizada após mudança de cidade/região', {
            placaId: id,
            empresaId
          });
        } catch (reorgError) {
          Log.error('[PlacaService] Falha ao reorganizar numeração', {
            error: toDomainError(reorgError).message,
            placaId: id,
            empresaId
          });
          // Não falhar a atualização por causa da reorganização
        }
      }

      Log.info('[PlacaService] Placa atualizada com sucesso', {
        placaId: id,
        empresaId
      });

      return Result.ok(result.value);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(
          new ValidationError(
            [{ field: 'data', message: 'Dados de entrada inválidos' }]
          )
        );
      }

      const domainError = toDomainError(error);
      Log.error('[PlacaService] Erro ao atualizar placa', {
        error: domainError.message,
        placaId: id,
        empresaId
      });

      return Result.fail(domainError);
    }
  }

  /**
   * Lista placas com paginação, filtros e dados de aluguel
   */
  async listPlacas(
    empresaId: string,
    query: unknown
  ): Promise<Result<PaginatedPlacasResponse, DomainError>> {
    try {
      // Validar query params
      const validatedQuery = validateListQuery(query);

      // Buscar via repository
      const result = await this.repository.findAll(empresaId, validatedQuery);

      if (result.isFailure) {
        return Result.fail(result.error);
      }

      const { data, total } = result.value;
      const { page, limit } = validatedQuery;

      // Enriquecer com dados de aluguel
      const placasComAluguel = await this.enrichWithAluguelData(data, empresaId);

      // Transformar para lista resumida
      const items = toListItems(placasComAluguel);

      const totalPages = Math.ceil(total / limit);

      const response: PaginatedPlacasResponse = {
        data: items,
        pagination: {
          totalDocs: total,
          totalPages: totalPages,
          currentPage: page,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };

      Log.info('[PlacaService] Placas listadas com sucesso', {
        count: items.length,
        total,
        page,
        empresaId
      });

      return Result.ok(response);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(
          new ValidationError(
            [{ field: 'query', message: 'Parâmetros de consulta inválidos' }]
          )
        );
      }

      const domainError = toDomainError(error);
      Log.error('[PlacaService] Erro ao listar placas', {
        error: domainError.message,
        empresaId
      });

      return Result.fail(domainError);
    }
  }

  /**
   * Busca placa por ID
   */
  async getPlacaById(
    id: string,
    empresaId: string
  ): Promise<Result<PlacaEntity, DomainError>> {
    try {
      const result = await this.repository.findById(id, empresaId);

      if (result.isFailure) {
        return Result.fail(result.error);
      }

      if (!result.value) {
        return Result.fail(new PlacaNotFoundError(id));
      }

      return Result.ok(result.value);
    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaService] Erro ao buscar placa', {
        error: domainError.message,
        placaId: id,
        empresaId
      });

      return Result.fail(domainError);
    }
  }

  /**
   * Enriquece placas com dados de aluguel ativo
   */
  private async enrichWithAluguelData(
    placas: PlacaEntity[],
    empresaId: string
  ): Promise<Array<PlacaEntity & {
    cliente_nome?: string;
    aluguel_data_inicio?: Date;
    aluguel_data_fim?: Date;
    aluguel_ativo?: boolean;
    aluguel_futuro?: boolean;
    statusAluguel?: 'disponivel' | 'alugada' | 'reservada';
  }>> {
    if (placas.length === 0) return [];

    const hoje = new Date();
    const placaIds = placas.map((p) => p._id);

    try {
      const alugueisAtivos = await Aluguel.find({
        $and: [
          {
            $or: [
              { placaId: { $in: placaIds } },
              { placa: { $in: placaIds } }
            ]
          },
          {
            $or: [
              { empresaId: empresaId },
              { empresa: empresaId }
            ]
          },
          {
            $or: [
              { endDate: { $gte: hoje } },
              { data_fim: { $gte: hoje } }
            ]
          }
        ]
      })
        .sort({ startDate: 1, data_inicio: 1 })
        .populate('clienteId', 'nome')
        .lean();

      const aluguelMap = alugueisAtivos.reduce<Record<string, {
        startDate: Date;
        endDate: Date;
        cliente?: { nome?: string };
      }>>((map, aluguelDoc) => {
        const aluguel = aluguelDoc as unknown as {
          placaId?: { toString(): string } | string;
          placa?: { toString(): string } | string;
          startDate?: Date;
          endDate?: Date;
          data_inicio?: Date;
          data_fim?: Date;
          clienteId?: { nome?: string };
          cliente?: { nome?: string };
        };

        const placaId = (aluguel.placaId || aluguel.placa)?.toString();
        if (placaId && !map[placaId]) {
          map[placaId] = {
            startDate: aluguel.startDate || aluguel.data_inicio || hoje,
            endDate: aluguel.endDate || aluguel.data_fim || hoje,
            cliente: aluguel.clienteId || aluguel.cliente
          };
        }

        return map;
      }, {});

      return placas.map((placa) => {
        const placaEnriquecida: PlacaEntity & {
          cliente_nome?: string;
          aluguel_data_inicio?: Date;
          aluguel_data_fim?: Date;
          aluguel_ativo?: boolean;
          aluguel_futuro?: boolean;
          statusAluguel?: 'disponivel' | 'alugada' | 'reservada';
        } = {
          ...placa,
          aluguel_ativo: false,
          aluguel_futuro: false,
          statusAluguel: 'disponivel'
        };

        const aluguel = aluguelMap[placa._id.toString()];
        if (aluguel && aluguel.cliente) {
          const dataInicio = new Date(aluguel.startDate);
          const dataFim = new Date(aluguel.endDate);

          placaEnriquecida.cliente_nome = aluguel.cliente.nome;
          placaEnriquecida.aluguel_data_inicio = aluguel.startDate;
          placaEnriquecida.aluguel_data_fim = aluguel.endDate;
          placaEnriquecida.aluguel_ativo = true;
          placaEnriquecida.aluguel_futuro = dataInicio > hoje;

          if (dataInicio > hoje) {
            placaEnriquecida.statusAluguel = 'reservada';
          } else if (dataFim >= hoje) {
            placaEnriquecida.statusAluguel = 'alugada';
          }
        }

        return placaEnriquecida;
      });
    } catch (error) {
      Log.warn('[PlacaService] Erro ao enriquecer com dados de aluguel', {
        error: toDomainError(error).message
      });
      return placas;
    }
  }
  /**
   * Aceita payload legado do frontend e converte para o shape validado pelo DTO refatorado.
   */
  private normalizeIncomingPayload(data: unknown): PersistencePayload | unknown {
    if (!data || typeof data !== 'object') return data;

    const payload: PersistencePayload = {
      ...(data as Record<string, unknown>)
    } as PersistencePayload;

    if (!payload.regiaoId && payload.regiao) {
      payload.regiaoId = payload.regiao;
    }

    if (!payload.localizacao && payload.nomeDaRua) {
      payload.localizacao = payload.nomeDaRua;
    }

    if (typeof payload.disponivel === 'boolean' && typeof payload.ativa !== 'boolean') {
      payload.ativa = payload.disponivel;
    }

    if (typeof payload.coordenadas === 'string') {
      const [lat, lng] = payload.coordenadas
        .split(',')
        .map((value: string) => Number.parseFloat(value.trim()));

      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        payload.coordenadas = { latitude: lat, longitude: lng };
      }
    }

    return payload;
  }

  /**
   * Normaliza o payload validado para o schema persistido atual (legado).
   */
  private normalizeForPersistence(data: unknown): PersistencePayload {
    const payload: PersistencePayload = {
      ...((data && typeof data === 'object') ? (data as Record<string, unknown>) : {})
    };

    if (!payload.nomeDaRua && payload.localizacao) {
      payload.nomeDaRua = payload.localizacao;
    }

    if (payload.coordenadas && typeof payload.coordenadas === 'object') {
      const { latitude, longitude } = payload.coordenadas;
      if (latitude != null && longitude != null) {
        payload.coordenadas = `${latitude}, ${longitude}`;
      }
    }

    if (typeof payload.ativa === 'boolean' && typeof payload.disponivel !== 'boolean') {
      payload.disponivel = payload.ativa;
    }

    return payload;
  }

  /**
   * Deleta uma placa
   */
  async deletePlaca(
    id: string,
    empresaId: string
  ): Promise<Result<void, DomainError>> {
    try {
      // Deletar via repository
      const result = await this.repository.delete(id, empresaId);

      if (result.isFailure) {
        return Result.fail(result.error);
      }

      // Reorganizar numeração após deletar
      try {
        await reorganizarPlacas(empresaId);
        Log.info('[PlacaService] Numeração reorganizada após deletar placa', {
          placaId: id,
          empresaId
        });
      } catch (reorgError) {
        Log.error('[PlacaService] Falha ao reorganizar numeração após delete', {
          error: toDomainError(reorgError).message,
          placaId: id,
          empresaId
        });
        // Não falhar o delete por causa da reorganização
      }

      Log.info('[PlacaService] Placa deletada com sucesso', {
        placaId: id,
        empresaId
      });

      return Result.ok(undefined);
    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaService] Erro ao deletar placa', {
        error: domainError.message,
        placaId: id,
        empresaId
      });

      return Result.fail(domainError);
    }
  }

  /**
   * Reorganiza a numeração das placas
   */
  async reorganizarPlacas(empresaId: string): Promise<Result<void, DomainError>> {
    try {
      await reorganizarPlacas(empresaId);

      Log.info('[PlacaService] Numeração reorganizada com sucesso', { empresaId });

      return Result.ok(undefined);
    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaService] Erro ao reorganizar placas', {
        error: domainError.message,
        empresaId
      });

      return Result.fail(domainError);
    }
  }
}

