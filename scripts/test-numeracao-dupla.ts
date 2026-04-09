/**
 * Script de teste para numeração dupla de placas
 * Cria dados de teste e verifica a funcionalidade
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Placa from '../src/modules/placas/Placa';
import Regiao from '../src/modules/regioes/Regiao';
import Empresa from '../src/modules/empresas/Empresa';
import User from '../src/modules/users/User';
import { reorganizarPlacas } from '../src/utils/numeracao';
import logger from '../src/shared/container/logger';

// Carregar variáveis de ambiente
dotenv.config();

async function testarNumeracaoDupla() {
  try {
    logger.info('[TesteNumeracao] Iniciando testes de numeração dupla');

    // Conectar ao MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/inmidia';
    await mongoose.connect(mongoUri);
    logger.info('[TesteNumeracao] Conectado ao MongoDB');

    // Buscar empresa existente
    const empresa = await Empresa.findOne();
    if (!empresa) {
      logger.error('[TesteNumeracao] Nenhuma empresa encontrada');
      return;
    }
    logger.info(`[TesteNumeracao] Usando empresa: ${empresa._id}`);

    // Criar região se não existir
    let regiao = await Regiao.findOne({ empresaId: empresa._id });
    if (!regiao) {
      regiao = new Regiao({
        nome: 'Centro',
        empresaId: empresa._id
      });
      await regiao.save();
      logger.info(`[TesteNumeracao] Região criada: ${regiao._id}`);
    }

    // Limpar placas existentes para teste limpo
    await Placa.deleteMany({ empresaId: empresa._id });
    logger.info('[TesteNumeracao] Placas existentes removidas');

    // Criar algumas placas de teste
    const placasTeste = [
      { numero_placa: 'ABC-001', cidade: 'São Paulo' },
      { numero_placa: 'ABC-002', cidade: 'São Paulo' },
      { numero_placa: 'DEF-001', cidade: 'Rio de Janeiro' },
      { numero_placa: 'DEF-002', cidade: 'Rio de Janeiro' },
      { numero_placa: 'GHI-001', cidade: 'Belo Horizonte' }
    ];

    logger.info('[TesteNumeracao] Criando placas de teste...');
    for (const placaData of placasTeste) {
      const placa = new Placa({
        ...placaData,
        regiaoId: regiao._id,
        empresaId: empresa._id,
        disponivel: true,
        ativa: true
      });
      await placa.save();
      logger.info(`[TesteNumeracao] Placa criada: ${placa.numero_placa} - ${placa.cidade} - ID: ${placa._id}`);
    }

    // Executar reorganização
    logger.info('[TesteNumeracao] Executando reorganização...');
    await reorganizarPlacas(empresa._id.toString());

    // Verificar resultado
    const placasReorganizadas = await Placa.find({ empresaId: empresa._id })
      .sort({ numero_global: 1 })
      .select('numero_placa cidade numero_regiao numero_global codigo nome_placa');

    logger.info('[TesteNumeracao] Resultado da reorganização:');
    placasReorganizadas.forEach((placa, index) => {
      logger.info(`  ${index + 1}. ${placa.numero_placa} | ${placa.cidade} | Reg: ${placa.numero_regiao} | Global: ${placa.numero_global} | Codigo: ${placa.codigo} | Nome: ${placa.nome_placa}`);
    });

    // Verificar numeração por cidade
    logger.info('[TesteNumeracao] Verificação por cidade:');
    const cidades = [...new Set(placasReorganizadas.map(p => p.cidade))];
    for (const cidade of cidades) {
      const placasCidade = placasReorganizadas.filter(p => p.cidade === cidade);
      logger.info(`  ${cidade}: ${placasCidade.map(p => p.numero_regiao).join(', ')}`);
    }

    // Verificar numeração global
    const numerosGlobais = placasReorganizadas.map(p => p.numero_global).filter((n): n is number => n !== undefined).sort((a, b) => a - b);
    logger.info(`[TesteNumeracao] Numeração global: ${numerosGlobais.join(', ')}`);

    // Verificar se não há duplicatas
    const uniqueGlobais = new Set(numerosGlobais);
    if (uniqueGlobais.size === numerosGlobais.length) {
      logger.info('[TesteNumeracao] ✅ Numeração global sem duplicatas');
    } else {
      logger.error('[TesteNumeracao] ❌ Duplicatas encontradas na numeração global');
    }

    logger.info('[TesteNumeracao] Testes concluídos com sucesso!');

  } catch (error) {
    logger.error('[TesteNumeracao] Erro nos testes:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('[TesteNumeracao] Desconectado do MongoDB');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  testarNumeracaoDupla()
    .then(() => {
      logger.info('[TesteNumeracao] Script executado com sucesso');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('[TesteNumeracao] Script falhou:', error);
      process.exit(1);
    });
}

export default testarNumeracaoDupla;