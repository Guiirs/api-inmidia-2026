/**
 * Script de migração para implementar numeração dupla de placas
 * Executa reorganizarPlacas para dados existentes
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { reorganizarPlacas } from '../src/utils/numeracao';
import Placa from '../src/modules/placas/Placa';
import logger from '../src/shared/container/logger';

// Carregar variáveis de ambiente
dotenv.config();

async function migratePlacasNumeracao() {
  try {
    logger.info('[MigratePlacas] Iniciando migração de numeração de placas');

    // Conectar ao MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/inmidia';
    await mongoose.connect(mongoUri);
    logger.info('[MigratePlacas] Conectado ao MongoDB');

    // Buscar todas as empresas distintas
    const empresas = await Placa.distinct('empresaId');
    logger.info(`[MigratePlacas] Encontradas ${empresas.length} empresas com placas`);

    for (const empresaId of empresas) {
      logger.info(`[MigratePlacas] Migrando placas da empresa ${empresaId}`);

      try {
        await reorganizarPlacas(empresaId.toString());
        logger.info(`[MigratePlacas] Numeração migrada para empresa ${empresaId}`);
      } catch (error) {
        logger.error(`[MigratePlacas] Erro ao migrar empresa ${empresaId}:`, error);
        // Continua para próxima empresa
      }
    }

    logger.info('[MigratePlacas] Migração concluída com sucesso');

  } catch (error) {
    logger.error('[MigratePlacas] Erro na migração:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('[MigratePlacas] Desconectado do MongoDB');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  migratePlacasNumeracao()
    .then(() => {
      logger.info('[MigratePlacas] Script executado com sucesso');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('[MigratePlacas] Script falhou:', error);
      process.exit(1);
    });
}

export { migratePlacasNumeracao };