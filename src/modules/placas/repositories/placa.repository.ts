/**
 * Placa Repository
 * Camada de acesso a dados com Result pattern
 */

import { FilterQuery } from 'mongoose';
import Placa from '../Placa';
import { Result, DomainError } from '@shared/core';
import { 
  DatabaseError, 
  PlacaNotFoundError,
  DuplicateKeyError,
  toDomainError
} from '@shared/core';
import { Log } from '@shared/core';
import type { 
  PlacaEntity, 
  CreatePlacaDTO, 
  UpdatePlacaDTO,
  ListPlacasQueryDTO 
} from '../dtos/placa.dto';

export interface IPlacaRepository {
  create(data: CreatePlacaDTO, empresaId: string): Promise<Result<PlacaEntity, DomainError>>;
  findById(id: string, empresaId: string): Promise<Result<PlacaEntity | null, DomainError>>;
  findAll(empresaId: string, query: ListPlacasQueryDTO): Promise<Result<{ data: PlacaEntity[], total: number }, DomainError>>;
  update(id: string, data: UpdatePlacaDTO, empresaId: string): Promise<Result<PlacaEntity, DomainError>>;
  delete(id: string, empresaId: string): Promise<Result<void, DomainError>>;
  exists(id: string, empresaId: string): Promise<Result<boolean, DomainError>>;
  countByRegiao(regiaoId: string, empresaId: string): Promise<Result<number, DomainError>>;
  findByNumeroPlaca(numeroPlaca: string, empresaId: string): Promise<Result<PlacaEntity | null, DomainError>>;
}

export class PlacaRepository implements IPlacaRepository {
  
  /**
   * Cria uma nova placa
   */
  async create(
    data: CreatePlacaDTO, 
    empresaId: string
  ): Promise<Result<PlacaEntity, DomainError>> {
    try {
      const placa = new Placa({
        ...data,
        empresaId,
        ativa: data.ativa ?? true
      });

      await placa.save();
      await placa.populate('regiaoId', 'nome');
      
      Log.info('[PlacaRepository] Placa criada', { 
        placaId: placa._id,
        numeroPlaca: placa.numero_placa,
        empresaId 
      });

      return Result.ok(placa.toObject<PlacaEntity>());

    } catch (error) {
      // Mongoose duplicate key error
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        const field = 'keyPattern' in error && error.keyPattern && typeof error.keyPattern === 'object'
          ? Object.keys(error.keyPattern)[0] || 'desconhecido'
          : 'desconhecido';
        
        Log.warn('[PlacaRepository] Tentativa de criar placa duplicada', { field, empresaId });
        return Result.fail(new DuplicateKeyError(field));
      }

      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao criar placa', { 
        error: domainError.message,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('create', domainError.message));
    }
  }

  /**
   * Busca placa por ID
   */
  async findById(
    id: string, 
    empresaId: string
  ): Promise<Result<PlacaEntity | null, DomainError>> {
    try {
      const placa = await Placa.findOne({ _id: id, empresaId })
        .populate('regiaoId', 'nome')
        .lean();
      
      if (!placa) {
        return Result.ok(null);
      }

      return Result.ok(placa as unknown as PlacaEntity);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao buscar placa', { 
        error: domainError.message,
        placaId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('findById', domainError.message));
    }
  }

  /**
   * Lista placas com filtros e paginação
   */
  async findAll(
    empresaId: string,
    query: ListPlacasQueryDTO
  ): Promise<Result<{ data: PlacaEntity[], total: number }, DomainError>> {
    try {
      const { page, limit, sortBy, order, search, regiaoId, tipo, ativa } = query;

      // Construir filtro
      const filter: FilterQuery<any> = { empresaId };
      
      if (ativa !== undefined) {
        filter.ativa = ativa;
      }
      
      if (regiaoId) {
        filter.regiaoId = regiaoId;
      }
      
      if (tipo) {
        filter.tipo = tipo;
      }
      
      if (search) {
        filter.$or = [
          { numero_placa: { $regex: search, $options: 'i' } },
          { localizacao: { $regex: search, $options: 'i' } }
        ];
      }

      // Executar queries em paralelo
      const skip = (page - 1) * limit;
      const sortOrder = order === 'desc' ? -1 : 1;

      const [data, total] = await Promise.all([
        Placa.find(filter)
          .populate('regiaoId', 'nome')
          .sort({ [sortBy]: sortOrder })
          .skip(skip)
          .limit(limit)
          .lean(),
        Placa.countDocuments(filter)
      ]);

      return Result.ok({
        data: data as unknown as PlacaEntity[],
        total
      });

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao listar placas', { 
        error: domainError.message,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('findAll', domainError.message));
    }
  }

  /**
   * Atualiza placa
   */
  async update(
    id: string,
    data: UpdatePlacaDTO,
    empresaId: string
  ): Promise<Result<PlacaEntity, DomainError>> {
    try {
      const placa = await Placa.findOneAndUpdate(
        { _id: id, empresaId },
        { $set: data },
        { new: true, runValidators: true }
      )
      .populate('regiaoId', 'nome')
      .lean();

      if (!placa) {
        return Result.fail(new PlacaNotFoundError(id));
      }

      Log.info('[PlacaRepository] Placa atualizada', { 
        placaId: id,
        empresaId 
      });

      return Result.ok(placa as unknown as PlacaEntity);

    } catch (error) {
      // Duplicate key error
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        const field = 'keyPattern' in error && error.keyPattern && typeof error.keyPattern === 'object'
          ? Object.keys(error.keyPattern)[0] || 'desconhecido'
          : 'desconhecido';
        
        return Result.fail(new DuplicateKeyError(field));
      }

      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao atualizar placa', { 
        error: domainError.message,
        placaId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('update', domainError.message));
    }
  }

  /**
   * Deleta placa
   */
  async delete(
    id: string,
    empresaId: string
  ): Promise<Result<void, DomainError>> {
    try {
      const result = await Placa.deleteOne({ _id: id, empresaId });

      if (result.deletedCount === 0) {
        return Result.fail(new PlacaNotFoundError(id));
      }

      Log.info('[PlacaRepository] Placa deletada', { 
        placaId: id,
        empresaId 
      });

      return Result.ok(undefined);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao deletar placa', { 
        error: domainError.message,
        placaId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('delete', domainError.message));
    }
  }

  /**
   * Verifica se placa existe
   */
  async exists(
    id: string,
    empresaId: string
  ): Promise<Result<boolean, DomainError>> {
    try {
      const count = await Placa.countDocuments({ _id: id, empresaId });
      return Result.ok(count > 0);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao verificar existência', { 
        error: domainError.message,
        placaId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('exists', domainError.message));
    }
  }

  /**
   * Conta placas por região
   */
  async countByRegiao(regiaoId: string, empresaId: string): Promise<Result<number, DomainError>> {
    try {
      const count = await Placa.countDocuments({ regiaoId, empresaId });
      return Result.ok(count);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao contar placas por região', { 
        error: domainError.message,
        regiaoId,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('countByRegiao', domainError.message));
    }
  }

  /**
   * Busca placa por número
   */
  async findByNumeroPlaca(
    numeroPlaca: string,
    empresaId: string
  ): Promise<Result<PlacaEntity | null, DomainError>> {
    try {
      const placa = await Placa.findOne({ numero_placa: numeroPlaca, empresaId })
        .populate('regiaoId', 'nome')
        .lean();
      
      if (!placa) {
        return Result.ok(null);
      }

      return Result.ok(placa as unknown as PlacaEntity);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao buscar placa por número', { 
        error: domainError.message,
        numeroPlaca,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('findByNumeroPlaca', domainError.message));
    }
  }
}
