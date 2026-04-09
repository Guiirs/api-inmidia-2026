/**
 * Script simples para testar conexão MongoDB
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Carregar variáveis de ambiente
dotenv.config();

async function testConnection() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/inmidia';
    console.log('Tentando conectar a:', mongoUri);

    await mongoose.connect(mongoUri);
    console.log('✅ Conectado com sucesso!');

    await mongoose.disconnect();
    console.log('✅ Desconectado com sucesso!');

  } catch (error) {
    console.error('❌ Erro de conexão:', error);
    process.exit(1);
  }
}

testConnection();