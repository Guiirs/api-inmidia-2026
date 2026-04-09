/**
 * Utilitários para numeração de placas
 */

import Placa from '@modules/placas/Placa';
import { Log } from '@shared/core';
import mongoose from 'mongoose';

/**
 * Reorganiza a numeração das placas
 * - Ordena cidades por quantidade de placas DESC
 * - Atribui numero_global sequencial
 * - Mantém numero_regiao por cidade
 */
export async function reorganizarPlacas(empresaId: string): Promise<void> {
  try {
    Log.info('[NumeracaoUtils] Iniciando reorganização de placas', { empresaId });

    // 1. Contar placas por cidade
    const placasPorCidade = await Placa.aggregate([
      { $match: { empresaId: new mongoose.Types.ObjectId(empresaId), ativa: true } },
      {
        $group: {
          _id: '$cidade',
          count: { $sum: 1 },
          placas: { $push: { _id: '$_id', numero_regiao: '$numero_regiao' } }
        }
      },
      { $sort: { count: -1 } } // Ordenar cidades por quantidade DESC
    ]);

    Log.info('[NumeracaoUtils] Query result', {
      totalPlacas: placasPorCidade.length,
      cidades: placasPorCidade.map(c => ({ cidade: c._id, count: c.count }))
    });

    // Debug: verificar placas diretamente
    const todasPlacas = await Placa.find({ empresaId, ativa: true }).select('cidade numero_placa');
    Log.info('[NumeracaoUtils] Placas encontradas diretamente', {
      count: todasPlacas.length,
      cidades: todasPlacas.map(p => ({ numero_placa: p.numero_placa, cidade: p.cidade }))
    });

    let numeroGlobal = 1;
    const bulkOps: any[] = [];

    // 2. Para cada cidade, ordenar placas por numero_regiao e atribuir numeração
    for (const cidadeGroup of placasPorCidade) {
      const { _id: cidade } = cidadeGroup;

      // Buscar todas as placas da cidade
      const placasCidade = await Placa.find({
        empresaId: new mongoose.Types.ObjectId(empresaId),
        cidade,
        ativa: true
      }).sort({ numero_regiao: 1 });

      let numeroRegiao = 1;

      for (const placa of placasCidade) {
        // Gerar código e nome_placa
        const siglaCidade = cidade
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Za-z0-9]/g, '')
          .substring(0, 3)
          .padEnd(3, 'X')
          .toUpperCase();

        const numeroRegiaoStr = String(numeroRegiao).padStart(2, '0');
        const codigo = `${siglaCidade}-${numeroRegiaoStr}`;
        const nome_placa = `Placa ${numeroRegiaoStr}`;

        bulkOps.push({
          updateOne: {
            filter: { _id: placa._id },
            update: {
              numero_regiao: numeroRegiao,
              numero_global: numeroGlobal,
              codigo,
              nome_placa
            }
          }
        });
        numeroRegiao++;
        numeroGlobal++;
      }
    }

    if (bulkOps.length > 0) {
      const result = await Placa.bulkWrite(bulkOps);
      Log.info('[NumeracaoUtils] Reorganização concluída', {
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      });
    } else {
      Log.info('[NumeracaoUtils] Nenhuma placa para reorganizar');
    }

  } catch (error) {
    Log.error('[NumeracaoUtils] Erro na reorganização', { error: (error as Error).message });
    throw error;
  }
}

/**
 * Calcula o próximo numero_regiao para uma cidade
 */
export async function getProximoNumeroRegiao(cidade: string, empresaId: string): Promise<number> {
  const maxNumero = await Placa.findOne({ cidade, empresaId })
    .sort({ numero_regiao: -1 })
    .select('numero_regiao')
    .lean();

  return (maxNumero?.numero_regiao || 0) + 1;
}

/**
 * Calcula o próximo numero_global
 */
export async function getProximoNumeroGlobal(empresaId: string): Promise<number> {
  const maxGlobal = await Placa.findOne({ empresaId })
    .sort({ numero_global: -1 })
    .select('numero_global')
    .lean();

  return (maxGlobal?.numero_global || 0) + 1;
}