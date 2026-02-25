/**
 * Placa Controller
 * Camada de apresentação com Result Pattern
 */

import { Request, Response, NextFunction } from 'express';
import { IAuthRequest } from '../../../types/express.d';
import { getErrorStatusCode, Log, Cache } from '@shared/core';
import type { PlacaService } from '../services/placa.service';
import Placa from '../Placa';

export class PlacaController {
  constructor(private readonly placaService: PlacaService) {}

  /**
   * Cria nova placa
   * POST /api/v1/placas
   */
  async createPlacaController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;

      Log.info('[PlacaController] Criando nova placa', {
        userId,
        empresaId,
        hasFile: !!req.file
      });

      const result = await this.placaService.createPlaca(
        req.body,
        req.file as any,
        empresaId
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

      // Invalidar cache
      const clearResult = await Cache.clear(`placas:*`);
      if (clearResult.isFailure) {
        Log.warn('[PlacaController] Falha ao invalidar cache', {
          error: clearResult.error.message
        });
      }

      Log.info('[PlacaController] Placa criada com sucesso', {
        placaId: result.value._id,
        numeroPlaca: result.value.numero_placa,
        userId,
        empresaId
      });

      res.status(201).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Atualiza placa existente
   * PUT /api/v1/placas/:id
   */
  async updatePlacaController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;
      const { id: placaId } = req.params;

      if (!placaId) {
        res.status(400).json({
          success: false,
          error: 'ID da placa é obrigatório'
        });
        return;
      }

      Log.info('[PlacaController] Atualizando placa', {
        placaId,
        userId,
        empresaId,
        hasFile: !!req.file
      });

      const result = await this.placaService.updatePlaca(
        placaId,
        req.body,
        req.file as any,
        empresaId
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

      // Invalidar cache
      const clearResult = await Cache.clear(`placas:*`);
      if (clearResult.isFailure) {
        Log.warn('[PlacaController] Falha ao invalidar cache', {
          error: clearResult.error.message
        });
      }

      Log.info('[PlacaController] Placa atualizada com sucesso', {
        placaId,
        userId,
        empresaId
      });

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lista todas as placas com paginação
   * GET /api/v1/placas
   */
  async getAllPlacasController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;

      Log.info('[PlacaController] Listando placas', {
        userId,
        empresaId,
        query: req.query
      });

      // Cache key baseado nos parâmetros
      const page = req.query.page || 1;
      const limit = req.query.limit || 10;
      const normalizedQuery = Object.entries(req.query || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : String(value)}`)
        .join('&');
      const cacheKey = `placas:empresa:${empresaId}:page:${page}:limit:${limit}:q:${normalizedQuery}`;

      const cachedResult = await Cache.get<any>(cacheKey);

      if (cachedResult && cachedResult.isSuccess && cachedResult.value) {
        Log.info('[PlacaController] Cache HIT para placas', {
          empresaId,
          page
        });

        res.status(200).json({
          success: true,
          ...cachedResult.value,
          cached: true
        });
        return;
      }

      Log.info('[PlacaController] Cache MISS para placas', {
        empresaId,
        page
      });

      const result = await this.placaService.listPlacas(empresaId, req.query);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      // Salvar em cache (3 minutos)
      await Cache.set(cacheKey, result.value, 180);

      Log.info('[PlacaController] Placas listadas com sucesso', {
        count: result.value.data.length,
        total: result.value.pagination.totalDocs,
        empresaId
      });

      res.status(200).json({
        success: true,
        ...result.value
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Busca placa por ID
   * GET /api/v1/placas/:id
   */
  async getPlacaByIdController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;
      const { id: placaId } = req.params;

      if (!placaId) {
        res.status(400).json({
          success: false,
          error: 'ID da placa é obrigatório'
        });
        return;
      }

      Log.info('[PlacaController] Buscando placa por ID', {
        placaId,
        userId,
        empresaId
      });

      const result = await this.placaService.getPlacaById(placaId, empresaId);

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
      next(error);
    }
  }

  /**
   * Deleta placa
   * DELETE /api/v1/placas/:id
   */
  async deletePlacaController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;
      const { id: placaId } = req.params;

      if (!placaId) {
        res.status(400).json({
          success: false,
          error: 'ID da placa é obrigatório'
        });
        return;
      }

      Log.info('[PlacaController] Deletando placa', {
        placaId,
        userId,
        empresaId
      });

      const result = await this.placaService.deletePlaca(placaId, empresaId);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      // Invalidar cache
      const clearResult = await Cache.clear(`placas:*`);
      if (clearResult.isFailure) {
        Log.warn('[PlacaController] Falha ao invalidar cache', {
          error: clearResult.error.message
        });
      }

      Log.info('[PlacaController] Placa deletada com sucesso', {
        placaId,
        userId,
        empresaId
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Busca placas disponíveis por período
   * GET /api/v1/placas/disponiveis
   */
  async getPlacasDisponiveisController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;
      const { dataInicio, dataFim, data_inicio, data_fim } = req.query;

      // Normalizar parâmetros (suporta camelCase e snake_case)
      const startDate = (dataInicio || data_inicio) as string;
      const endDate = (dataFim || data_fim) as string;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'Os parâmetros dataInicio e dataFim são obrigatórios'
        });
        return;
      }

      Log.info('[PlacaController] Buscando placas disponíveis', {
        userId,
        empresaId,
        startDate,
        endDate
      });

      const placas = await (this.placaService as any).getPlacasDisponiveis(
        empresaId,
        startDate,
        endDate,
        req.query
      );

      Log.info('[PlacaController] Placas disponíveis encontradas', {
        count: placas.length,
        empresaId
      });

      res.status(200).json({
        success: true,
        data: placas,
        count: placas.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Busca localizações (coordenadas) das placas
   * GET /api/v1/placas/locations
   */
  async getPlacaLocationsController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;

      Log.info('[PlacaController] Buscando localizações das placas', {
        userId,
        empresaId
      });

      // Busca direta no modelo para preservar schema legado (coordenadas string, nomeDaRua)
      // e evitar perda de dados no DTO resumido da listagem.
      const placas = await Placa.find({ empresaId })
        .select('_id numero_placa coordenadas nomeDaRua regiaoId')
        .populate('regiaoId', 'nome')
        .lean();

      const locations = (placas as any[])
        .map((placa) => {
          const coords = typeof placa.coordenadas === 'string' ? placa.coordenadas.trim() : '';
          if (!coords || !coords.includes(',')) return null;

          const [lat, lng] = coords.split(',').map((coord: string) => Number.parseFloat(coord.trim()));
          if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

          const regiao = placa.regiaoId && typeof placa.regiaoId === 'object' ? placa.regiaoId : null;
          const regiaoId =
            regiao?._id?.toString?.() || (typeof placa.regiaoId === 'string' ? placa.regiaoId : undefined);
          const id = placa._id?.toString?.() || placa._id;

          return {
            id,
            _id: id,
            numero_placa: placa.numero_placa,
            nomeDaRua: placa.nomeDaRua,
            coordenadas: coords,
            latitude: lat,
            longitude: lng,
            regiaoId,
            regiao: regiaoId ? { _id: regiaoId, id: regiaoId, nome: regiao?.nome || 'Sem regiao' } : undefined
          };
        })
        .filter(Boolean);

      Log.info('[PlacaController] Localizações encontradas', {
        count: locations.length,
        empresaId
      });

      res.status(200).json({
        success: true,
        data: locations,
        count: locations.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Toggle disponibilidade da placa
   * PATCH /api/v1/placas/:id/disponibilidade
   */
  async toggleDisponibilidadeController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;
      const { id: placaId } = req.params;

      if (!placaId) {
        res.status(400).json({
          success: false,
          error: 'ID da placa é obrigatório'
        });
        return;
      }

      Log.info('[PlacaController] Toggle disponibilidade da placa', {
        placaId,
        userId,
        empresaId
      });

      // Buscar placa atual
      const placaResult = await this.placaService.getPlacaById(placaId, empresaId);

      if (placaResult.isFailure) {
        const statusCode = getErrorStatusCode(placaResult.error);
        res.status(statusCode).json({
          success: false,
          error: placaResult.error.message,
          code: placaResult.error.code
        });
        return;
      }

      const currentPlaca = placaResult.value;

      const currentDisponivel =
        typeof (currentPlaca as any).disponivel === 'boolean'
          ? (currentPlaca as any).disponivel
          : Boolean((currentPlaca as any).ativa);

      // Atualizar disponibilidade (campo 'ativa' com normalização para o service)
      const result = await this.placaService.updatePlaca(
        placaId,
        { ativa: !currentDisponivel } as any,
        undefined,
        empresaId
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

      // Invalidar cache
      await Cache.clear(`placas:*`);

      Log.info('[PlacaController] Disponibilidade alterada', {
        placaId,
        novaDisponibilidade: !currentDisponivel,
        empresaId
      });

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      next(error);
    }
  }
}
