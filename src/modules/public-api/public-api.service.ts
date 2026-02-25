/**
 * Public API Service
 * Servicos publicos da API
 */
import Placa from '../placas/Placa';
import mongoose from 'mongoose';
import logger from '../../shared/container/logger';
import AppError from '../../shared/container/AppError';

class PublicApiService {
  constructor() {}

  async getAvailablePlacas(empresa_id: string | mongoose.Types.ObjectId): Promise<any[]> {
    logger.info(`[PublicApiService] Buscando placas disponiveis para empresa ID: ${empresa_id}.`);

    if (!empresa_id || !mongoose.Types.ObjectId.isValid(String(empresa_id))) {
      throw new AppError('ID da empresa invalido fornecido.', 400);
    }

    const empresaObjectId = new mongoose.Types.ObjectId(String(empresa_id));

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
}

export default PublicApiService;
