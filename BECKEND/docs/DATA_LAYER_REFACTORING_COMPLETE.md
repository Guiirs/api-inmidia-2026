# Refatoração da Camada de Dados - Separação de Schemas e Models

## Data: 27 de Novembro de 2025

## Objetivo
Separar as definições de Schema (Mongoose) da inicialização dos Models em todos os arquivos do diretório `src/models`, seguindo o padrão de arquitetura de software sênior.

## Estrutura Criada

### Nova Estrutura de Diretórios
```
src/
├── database/
│   └── schemas/
│       ├── AluguelSchema.ts
│       ├── BiWeekSchema.ts
│       ├── ClienteSchema.ts
│       ├── ContratoSchema.ts
│       ├── EmpresaSchema.ts
│       ├── PiGenJobSchema.ts
│       ├── PlacaSchema.ts
│       ├── PropostaInternaSchema.ts
│       ├── RegiaoSchema.ts
│       ├── UserSchema.ts
│       ├── WebhookSchema.ts
│       └── index.ts
└── models/
    ├── Aluguel.ts (refatorado)
    ├── BiWeek.ts (refatorado)
    ├── Cliente.ts (refatorado)
    ├── Contrato.ts (refatorado)
    ├── Empresa.ts (refatorado)
    ├── PiGenJob.ts (refatorado)
    ├── Placa.ts (refatorado)
    ├── PropostaInterna.ts (refatorado)
    ├── Regiao.ts (refatorado)
    ├── User.ts (refatorado)
    └── Webhook.ts (refatorado)
```

## Arquivos Refatorados

### 1. AluguelSchema.ts
**Localização:** `src/database/schemas/AluguelSchema.ts`
**Conteúdo:**
- Schema completo com sistema de períodos unificado (v2.0)
- Campos legados mantidos para compatibilidade
- Indexes para queries otimizadas
- Virtuals para acesso bidirecional
- Hook pre-save para sincronização de campos

**Model:** `src/models/Aluguel.ts`
- Import do schema
- Import da interface
- Inicialização do Model
- Export default mantido

### 2. BiWeekSchema.ts
**Localização:** `src/database/schemas/BiWeekSchema.ts`
**Conteúdo:**
- Schema completo para gerenciamento de bi-semanas
- Validações customizadas
- Compound indexes
- Virtual id
- Pre-save validation hook

**Model:** `src/models/BiWeek.ts`
- Import do schema
- Métodos estáticos: `findByDate`, `findByYear`, `generateCalendar`
- Método de instância: `getFormattedPeriod`
- Inicialização do Model

### 3. ClienteSchema.ts
**Localização:** `src/database/schemas/ClienteSchema.ts`
**Conteúdo:**
- Schema de clientes com validações completas
- Virtual id
- Compound index para unicidade de cpfCnpj por empresa

**Model:** `src/models/Cliente.ts`
- Estrutura limpa com import do schema
- Inicialização direta do Model

### 4. ContratoSchema.ts
**Localização:** `src/database/schemas/ContratoSchema.ts`
**Conteúdo:**
- Schema de contratos
- Indexes para relacionamentos
- Virtual id

**Model:** `src/models/Contrato.ts`
- Estrutura minimalista
- Import do schema e inicialização

### 5. EmpresaSchema.ts
**Localização:** `src/database/schemas/EmpresaSchema.ts`
**Conteúdo:**
- Schema de empresas
- Interface `IApiKeyHistory` exportada
- Pre-save hook para geração de API key
- Virtual id

**Model:** `src/models/Empresa.ts`
- Import e re-export de `IApiKeyHistory`
- Método de instância: `generateApiKey`
- Inicialização do Model

### 6. PiGenJobSchema.ts
**Localização:** `src/database/schemas/PiGenJobSchema.ts`
**Conteúdo:**
- Schema para jobs de geração de PI
- Índices compostos para otimização
- Virtual id

**Model:** `src/models/PiGenJob.ts`
- Estrutura limpa
- Inicialização do Model

### 7. PlacaSchema.ts
**Localização:** `src/database/schemas/PlacaSchema.ts`
**Conteúdo:**
- Schema de placas
- Compound indexes para queries
- Virtual id

**Model:** `src/models/Placa.ts`
- Estrutura minimalista
- Inicialização do Model

### 8. PropostaInternaSchema.ts
**Localização:** `src/database/schemas/PropostaInternaSchema.ts`
**Conteúdo:**
- Schema de propostas internas
- Sistema unificado de períodos
- Campos legados para compatibilidade
- Indexes otimizados
- Virtual id

**Model:** `src/models/PropostaInterna.ts`
- Estrutura limpa
- Inicialização do Model

### 9. RegiaoSchema.ts
**Localização:** `src/database/schemas/RegiaoSchema.ts`
**Conteúdo:**
- Schema de regiões
- Compound index para unicidade por empresa
- Virtual id

**Model:** `src/models/Regiao.ts`
- Estrutura minimalista
- Inicialização do Model

### 10. UserSchema.ts
**Localização:** `src/database/schemas/UserSchema.ts`
**Conteúdo:**
- Schema de usuários
- Pre-save hook para hash de senha com bcrypt
- Virtual id

**Model:** `src/models/User.ts`
- Import do schema
- Método de instância: `comparePassword`
- Inicialização do Model

### 11. WebhookSchema.ts
**Localização:** `src/database/schemas/WebhookSchema.ts`
**Conteúdo:**
- Schema de webhooks
- Índices compostos
- Virtual id

**Model:** `src/models/Webhook.ts`
- Import do schema
- Métodos de instância: `registrarDisparo`, `escutaEvento`
- Inicialização do Model

## Arquivo Index

**Localização:** `src/database/schemas/index.ts`
**Finalidade:** Facilitar importações centralizadas de todos os schemas

## Padrão de Implementação

### Schema Files (src/database/schemas/)
```typescript
import { Schema } from 'mongoose';
import { IModel } from '../../types/models';

export const modelSchema = new Schema<IModel>({
  // Definição de campos
}, {
  // Opções
});

// Indexes
modelSchema.index({ campo: 1 });

// Virtuals
modelSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Hooks
modelSchema.pre('save', function(next) {
  // Lógica
  next();
});
```

### Model Files (src/models/)
```typescript
import mongoose, { Model } from 'mongoose';
import { IModel } from '../types/models';
import { modelSchema } from '../database/schemas/ModelSchema';

// Métodos estáticos/instância (se necessário)
modelSchema.methods.metodo = function() { };
modelSchema.statics.metodo = function() { };

const ModelName: Model<IModel> = 
  mongoose.models.ModelName || 
  mongoose.model<IModel>('ModelName', modelSchema);

export default ModelName;
```

## Benefícios da Refatoração

1. **Separação de Responsabilidades**: Schemas definem estrutura; Models gerenciam lógica de negócio
2. **Manutenibilidade**: Alterações de schema não afetam lógica do model
3. **Reutilização**: Schemas podem ser importados e extendidos facilmente
4. **Testabilidade**: Schemas podem ser testados independentemente
5. **Organização**: Estrutura clara e profissional
6. **Escalabilidade**: Fácil adicionar novos schemas/models

## Compatibilidade

- ✅ Todas as importações existentes em Controllers/Services permanecem funcionais
- ✅ Export default mantido em todos os Models
- ✅ Nenhuma quebra de API
- ✅ Métodos estáticos e de instância preservados
- ✅ Hooks e virtuals funcionando corretamente

## Verificações Realizadas

- ✅ Compilação TypeScript sem erros
- ✅ Todos os 11 arquivos refatorados com sucesso
- ✅ Estrutura de diretórios criada
- ✅ Index de schemas criado
- ✅ Imports corretos nos Models
- ✅ Nenhuma referência a Schema em src/models (exceto import de schemas)

## Status Final

**REFATORAÇÃO COMPLETA E PRONTA PARA PRODUÇÃO** ✅

Todos os arquivos foram refatorados seguindo o padrão de arquitetura empresarial, mantendo 100% de compatibilidade com o código existente.
