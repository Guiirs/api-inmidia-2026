/**
 * Public API Service
 * Servicos publicos da API
 */
import Placa from '../placas/Placa';
import Regiao from '../regioes/Regiao';
import mongoose from 'mongoose';
import logger from '../../shared/container/logger';
import AppError from '../../shared/container/AppError';

class PublicApiService {
  constructor() {}

  private ensureEmpresaId(empresa_id: string | mongoose.Types.ObjectId): mongoose.Types.ObjectId {
    if (!empresa_id || !mongoose.Types.ObjectId.isValid(String(empresa_id))) {
      throw new AppError('ID da empresa invalido fornecido.', 400);
    }

    return new mongoose.Types.ObjectId(String(empresa_id));
  }

  private mapPublicPlaca(placa: any) {
    const regiaoObj = placa.regiaoId && typeof placa.regiaoId === 'object'
      ? placa.regiaoId
      : (placa.regiao && typeof placa.regiao === 'object' ? placa.regiao : null);

    return {
      id: placa._id?.toString?.() || placa.id || null,
      _id: placa._id?.toString?.() || placa.id || null,
      numero_placa: placa.numero_placa || null,
      nomeDaRua: placa.nomeDaRua || placa.localizacao || null,
      bairro: placa.bairro || null,
      coordenadas: placa.coordenadas || null,
      imagem: placa.imagem || null,
      regiao: regiaoObj
        ? {
            _id: regiaoObj._id?.toString?.() || regiaoObj.id || null,
            id: regiaoObj._id?.toString?.() || regiaoObj.id || null,
            nome: regiaoObj.nome || null,
          }
        : null,
      regiao_nome: regiaoObj?.nome || null,
    };
  }

  private mapPublicRegiao(regiao: any) {
    return {
      id: regiao._id?.toString?.() || regiao.id || null,
      _id: regiao._id?.toString?.() || regiao.id || null,
      nome: regiao.nome || null,
      slug: regiao.slug || null,
    };
  }

  async getAvailablePlacas(empresa_id: string | mongoose.Types.ObjectId): Promise<any[]> {
    logger.info(`[PublicApiService] Buscando placas disponiveis para empresa ID: ${empresa_id}.`);

    const empresaObjectId = this.ensureEmpresaId(empresa_id);

    try {
      logger.debug(
        `[PublicApiService] Executando query find() para placas disponiveis da empresa ${empresaObjectId}.`
      );

      // Compatibilidade com schema novo (empresaId/regiaoId) e legado (empresa/regiao)
      const placasDisponiveis = await Placa.find({
        $and: [
          { disponivel: true },
          {
            $or: [{ empresaId: empresaObjectId }, { empresa: empresaObjectId }],
          },
        ],
      })
        .populate('regiaoId', 'nome')
        .populate('regiao', 'nome')
        .select('numero_placa coordenadas nomeDaRua tamanho imagem regiao regiaoId -_id')
        .lean()
        .exec();

      logger.info(
        `[PublicApiService] Encontradas ${placasDisponiveis.length} placas disponiveis para empresa ${empresa_id}.`
      );

      return placasDisponiveis.map((placa: any) => ({
        numero_placa: placa.numero_placa || null,
        coordenadas: placa.coordenadas || null,
        nomeDaRua: placa.nomeDaRua || null,
        tamanho: placa.tamanho || null,
        imagem: placa.imagem || null,
        regiao: placa.regiao?.nome || placa.regiaoId?.nome || null,
      }));
    } catch (error: any) {
      logger.error(
        `[PublicApiService] Erro Mongoose/DB ao buscar placas disponiveis para empresa ${empresa_id}: ${error.message}`,
        { stack: error.stack }
      );
      throw new AppError(`Erro interno ao buscar placas disponiveis: ${error.message}`, 500);
    }
  }

  async getPublicPlacas(
    empresa_id: string | mongoose.Types.ObjectId,
    query: { page?: number; limit?: number; regiaoId?: string; search?: string } = {}
  ): Promise<{ data: any[]; pagination: any }> {
    const empresaObjectId = this.ensureEmpresaId(empresa_id);
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 24)));
    const skip = (page - 1) * limit;

    const filter: any = {
      $or: [{ empresaId: empresaObjectId }, { empresa: empresaObjectId }],
    };

    if (query.regiaoId && mongoose.Types.ObjectId.isValid(String(query.regiaoId))) {
      const regiaoObjectId = new mongoose.Types.ObjectId(String(query.regiaoId));
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [{ regiaoId: regiaoObjectId }, { regiao: regiaoObjectId }],
        },
      ];
    }

    if (query.search) {
      const search = String(query.search).trim();
      if (search) {
        filter.$and = [
          ...(filter.$and || []),
          {
            $or: [
              { numero_placa: { $regex: search, $options: 'i' } },
              { nomeDaRua: { $regex: search, $options: 'i' } },
              { localizacao: { $regex: search, $options: 'i' } },
              { bairro: { $regex: search, $options: 'i' } },
            ],
          },
        ];
      }
    }

    const [placas, total] = await Promise.all([
      Placa.find(filter)
        .populate('regiaoId', 'nome')
        .populate('regiao', 'nome')
        .select('_id numero_placa nomeDaRua localizacao bairro coordenadas imagem regiao regiaoId')
        .sort({ numero_placa: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      Placa.countDocuments(filter),
    ]);

    return {
      data: placas.map((placa: any) => this.mapPublicPlaca(placa)),
      pagination: {
        totalDocs: total,
        totalPages: Math.ceil(total / limit) || 1,
        currentPage: page,
        limit,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async getPublicPlacaById(
    empresa_id: string | mongoose.Types.ObjectId,
    placaId: string
  ): Promise<any> {
    const empresaObjectId = this.ensureEmpresaId(empresa_id);

    if (!placaId || !mongoose.Types.ObjectId.isValid(String(placaId))) {
      throw new AppError('ID da placa invalido.', 400);
    }

    const placa = await Placa.findOne({
      _id: new mongoose.Types.ObjectId(String(placaId)),
      $or: [{ empresaId: empresaObjectId }, { empresa: empresaObjectId }],
    })
      .populate('regiaoId', 'nome')
      .populate('regiao', 'nome')
      .select('_id numero_placa nomeDaRua localizacao bairro coordenadas imagem regiao regiaoId')
      .lean()
      .exec();

    if (!placa) {
      throw new AppError('Placa não encontrada.', 404);
    }

    return this.mapPublicPlaca(placa);
  }

  async getPublicRegioes(
    empresa_id: string | mongoose.Types.ObjectId,
    query: { page?: number; limit?: number; search?: string } = {}
  ): Promise<any[]> {
    const empresaObjectId = this.ensureEmpresaId(empresa_id);
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 100)));
    const skip = (page - 1) * limit;

    const filter: any = {
      $or: [{ empresaId: empresaObjectId }, { empresa: empresaObjectId }],
    };

    if (query.search) {
      const search = String(query.search).trim();
      if (search) {
        filter.nome = { $regex: search, $options: 'i' };
      }
    }

    const regioes = await Regiao.find(filter)
      .select('_id nome slug')
      .sort({ nome: 1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    return regioes.map((r: any) => this.mapPublicRegiao(r));
  }
}

export default PublicApiService;
