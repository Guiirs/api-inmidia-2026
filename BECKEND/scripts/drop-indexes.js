#!/usr/bin/env node
/**
 * Script para dropar índices problemáticos no MongoDB
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function dropProblematicIndexes() {
  try {
    console.log('🔗 Conectando ao MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Conectado');

    const db = mongoose.connection.db;
    const collection = db.collection('empresas');

    console.log('📋 Listando índices atuais...');
    const indexes = await collection.listIndexes().toArray();
    console.log('Índices encontrados:');
    indexes.forEach((idx, i) => {
      console.log(`  ${i}: ${JSON.stringify(idx.key)}`);
    });

    // Dropar índice problemático api_key_hash_1
    try {
      console.log('\n🗑️ Removendo índice api_key_hash_1...');
      await collection.dropIndex('api_key_hash_1');
      console.log('✓ Índice api_key_hash_1 removido');
    } catch (e) {
      console.log(`⚠️  Índice não encontrado: ${e.message}`);
    }

    // Dropar índice problemático api_key_prefix_1
    try {
      console.log('🗑️ Removendo índice api_key_prefix_1...');
      await collection.dropIndex('api_key_prefix_1');
      console.log('✓ Índice api_key_prefix_1 removido');
    } catch (e) {
      console.log(`⚠️  Índice não encontrado: ${e.message}`);
    }

    console.log('\n📋 Índices após remoção:');
    const newIndexes = await collection.listIndexes().toArray();
    newIndexes.forEach((idx, i) => {
      console.log(`  ${i}: ${JSON.stringify(idx.key)}`);
    });

    console.log('\n✅ Operação concluída com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

dropProblematicIndexes();
