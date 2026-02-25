# Guia de Migração: Sistema de Períodos Legado → Unificado

## Visão Geral

Este guia descreve o processo de migração de aluguéis do sistema legado (v1.0) para o sistema unificado de períodos (v2.0).

---

## 1. Contexto da Mudança

### Sistema Legado (v1.0)
```typescript
{
  data_inicio: Date,        // Data de início
  data_fim: Date,           // Data de fim
  bi_week_ids: string[]     // IDs de bi-semanas (opcional)
}
```

**Problemas:**
- ❌ Nomenclatura inconsistente (`data_inicio` vs `startDate`)
- ❌ Sem distinção clara entre períodos bi-semanais e customizados
- ❌ Difícil validação e queries complexas
- ❌ Não suporta múltiplos tipos de período

### Sistema Unificado (v2.0+)
```typescript
{
  periodType: 'bi-week' | 'custom',  // Tipo explícito
  startDate: Date,                    // Nomenclatura padronizada
  endDate: Date,                      // Nomenclatura padronizada
  biWeekIds?: string[],               // Opcional, apenas para bi-week
  biWeeks?: ObjectId[]                // Referências populadas
}
```

**Benefícios:**
- ✅ Nomenclatura consistente em inglês
- ✅ Tipo de período explícito e validável
- ✅ Queries mais simples e performáticas
- ✅ Extensível para novos tipos (mensal, trimestral, etc.)
- ✅ Compatibilidade com sistema legado via virtuals

---

## 2. Estratégia de Compatibilidade

### 2.1 Campos Mantidos

Os campos legados **NÃO são removidos** no v2.0:

```typescript
/**
 * @deprecated Use startDate instead
 * @since 1.0.0
 * @removed 3.0.0 (planejado)
 */
data_inicio?: Date;

/**
 * @deprecated Use endDate instead
 * @since 1.0.0
 * @removed 3.0.0 (planejado)
 */
data_fim?: Date;

/**
 * @deprecated Use biWeekIds instead
 * @since 1.0.0
 * @removed 3.0.0 (planejado)
 */
bi_week_ids?: string[];
```

**Razão:** Permite rollback seguro e migração gradual.

### 2.2 Virtuals para Acesso Bidirecional

```typescript
// Acessa novo campo através de nome legado
aluguel.dataInicio  // → retorna startDate || data_inicio
aluguel.dataFim     // → retorna endDate || data_fim
aluguel.biWeekIdsLegacy // → retorna biWeekIds || bi_week_ids
```

### 2.3 Hook Pre-Save: Sincronização Automática

```typescript
aluguelSchema.pre('save', function(next) {
  // Novo → Legado
  if (this.startDate && !this.data_inicio) {
    this.data_inicio = this.startDate;
  }
  
  // Legado → Novo
  if (!this.startDate && this.data_inicio) {
    this.startDate = this.data_inicio;
  }
  
  next();
});
```

**Garante:** Ambos os sistemas sempre têm os mesmos dados.

---

## 3. Processo de Migração

### 3.1 Pré-requisitos

- ✅ Backup completo do banco de dados
- ✅ Sistema em manutenção (ou baixo tráfego)
- ✅ Testes em ambiente de staging
- ✅ Plano de rollback documentado

### 3.2 Passo 1: Backup

```bash
# MongoDB
mongodump --uri="mongodb://localhost:27017/seu_banco" --out=/backup/$(date +%Y%m%d)

# Verificar backup
ls -lh /backup/$(date +%Y%m%d)
```

### 3.3 Passo 2: Dry-Run (Teste)

```bash
# Executa migração SEM alterar dados
npm run migrate:alugueis:dry

# Saída esperada:
# [Migration] Modo: DRY-RUN (não altera dados)
# [Migration] Total de aluguéis a migrar: 1523
# [Migration] [DRY-RUN] Aluguel 64abc123...: periodType: bi-week, ...
# [Migration] Migrados: 1523
```

**Revisar:**
- ✅ Número de documentos a migrar
- ✅ Tipos de período identificados corretamente
- ✅ Sem erros ou warnings inesperados

### 3.4 Passo 3: Migração de Produção

```bash
# Migração completa
npm run migrate:alugueis

# OU migração parcial (primeiros 100 documentos)
npm run migrate:alugueis -- --limit=100
```

**Monitorar:**
```bash
# Terminal 1: Logs da aplicação
tail -f logs/combined.log

# Terminal 2: MongoDB queries
mongostat --host localhost:27017 -n 1

# Terminal 3: Verificar progresso
mongo --eval 'db.aluguels.countDocuments({periodType: {$exists: true}})'
```

### 3.5 Passo 4: Validação

```bash
# Verificar total migrado
mongo seu_banco --eval '
  db.aluguels.aggregate([
    {$group: {
      _id: "$periodType",
      count: {$sum: 1}
    }}
  ])
'

# Saída esperada:
# { "_id" : "bi-week", "count" : 892 }
# { "_id" : "custom", "count" : 631 }
```

**Validações Manuais:**

1. **Aluguel Bi-Week:**
```javascript
db.aluguels.findOne({ periodType: 'bi-week' })

// Verificar:
// - periodType === 'bi-week' ✅
// - startDate === data_inicio ✅
// - endDate === data_fim ✅
// - biWeekIds === bi_week_ids ✅
```

2. **Aluguel Custom:**
```javascript
db.aluguels.findOne({ periodType: 'custom' })

// Verificar:
// - periodType === 'custom' ✅
// - startDate === data_inicio ✅
// - endDate === data_fim ✅
// - biWeekIds === undefined ✅
```

3. **Queries Antigas (Compatibilidade):**
```javascript
// Query legado deve continuar funcionando
db.aluguels.find({
  data_inicio: { $lte: new Date('2025-01-15') },
  data_fim: { $gte: new Date('2025-01-01') }
})
```

---

## 4. Queries Atualizadas

### 4.1 Buscar Aluguéis por Período

#### ❌ Antes (Legado):
```typescript
await Aluguel.find({
  data_inicio: { $lte: endDate },
  data_fim: { $gte: startDate }
});
```

#### ✅ Depois (Unificado):
```typescript
await Aluguel.find({
  startDate: { $lte: endDate },
  endDate: { $gte: startDate }
});
```

#### ⚠️ Compatível (Fallback):
```typescript
await Aluguel.find({
  $or: [
    {
      startDate: { $lte: endDate },
      endDate: { $gte: startDate }
    },
    {
      data_inicio: { $lte: endDate },
      data_fim: { $gte: startDate }
    }
  ]
});
```

### 4.2 Buscar por Bi-Week

#### ❌ Antes (Legado):
```typescript
await Aluguel.find({ bi_week_ids: '2025-01' });
```

#### ✅ Depois (Unificado):
```typescript
await Aluguel.find({ biWeekIds: '2025-01' });
```

#### ⚠️ Compatível (Fallback):
```typescript
await Aluguel.find({
  $or: [
    { biWeekIds: '2025-01' },
    { bi_week_ids: '2025-01' }
  ]
});
```

### 4.3 Filtrar por Tipo de Período

#### ✅ Novo (v2.0 apenas):
```typescript
// Apenas aluguéis bi-semanais
await Aluguel.find({ periodType: 'bi-week' });

// Apenas aluguéis customizados
await Aluguel.find({ periodType: 'custom' });
```

---

## 5. Plano de Rollback

### 5.1 Se Migração Falhar Durante Execução

**Transações garantem rollback automático:**
```
[Migration] Erro ao processar aluguel 64abc123...
[Migration] Transação abortada devido a erro
```

✅ Nenhum dado é alterado  
✅ Pode reexecutar o script após corrigir o erro

### 5.2 Se Migração Completar com Dados Incorretos

**Restaurar backup:**
```bash
# 1. Parar aplicação
pm2 stop api

# 2. Restaurar banco
mongorestore --uri="mongodb://localhost:27017/seu_banco" \
  --drop \
  /backup/20251127

# 3. Reiniciar aplicação
pm2 start api

# 4. Verificar
curl http://localhost:3000/health
```

### 5.3 Rollback de Código

**Se necessário reverter para v1.0:**

```bash
# 1. Checkout da versão anterior
git checkout v1.0.x

# 2. Reinstalar dependências
npm install

# 3. Rebuild
npm run build

# 4. Reiniciar
npm start
```

**Campos legados garantem compatibilidade:**
- ✅ `data_inicio`, `data_fim`, `bi_week_ids` ainda existem
- ✅ Código antigo continua funcionando
- ✅ Sem perda de dados

---

## 6. Cronograma de Depreciação

### v2.0.0 (Atual - Nov 2025)
- ✅ Sistema unificado implementado
- ✅ Campos legados marcados como `@deprecated`
- ✅ Script de migração disponível
- ✅ Documentação completa
- ⚠️ **Ação:** Migrar dados (opcional mas recomendado)

### v2.5.0 (Março 2026 - Planejado)
- ⚠️ Warnings em logs ao usar campos legados
- 📝 Anúncio oficial de remoção em v3.0
- 🔔 Notificações para clientes API

### v3.0.0 (Setembro 2026 - Planejado)
- ❌ Remoção completa de campos legados:
  - `data_inicio`
  - `data_fim`
  - `bi_week_ids`
- ❌ Remoção de índices legados
- ❌ Remoção de virtuals de compatibilidade
- ⚠️ **Breaking Change:** Código que usa campos legados vai quebrar

---

## 7. FAQs

### Q: Posso continuar usando campos legados por enquanto?
**A:** Sim! Os campos legados são totalmente funcionais até v3.0 (2026). O hook pre-save garante sincronização automática.

### Q: O que acontece se eu criar um aluguel usando apenas campos legados?
**A:** O hook pre-save copia automaticamente para os campos novos. Ex:
```typescript
// Input (legado)
{ data_inicio: '2025-01-01', data_fim: '2025-01-15' }

// Salvo no banco (automático)
{
  data_inicio: '2025-01-01',
  data_fim: '2025-01-15',
  startDate: '2025-01-01',    // ✅ Copiado
  endDate: '2025-01-15',      // ✅ Copiado
  periodType: 'custom'        // ✅ Inferido
}
```

### Q: Preciso migrar dados imediatamente?
**A:** Não é obrigatório agora, mas **fortemente recomendado**:
- ✅ Melhor performance em queries
- ✅ Validação mais robusta
- ✅ Preparação para v3.0
- ✅ Evita rush de última hora

### Q: E se eu tiver APIs externas que usam campos legados?
**A:** Virtuals garantem acesso bidirecional:
```typescript
// API antiga continua funcionando
GET /alugueis/:id
{
  "data_inicio": "2025-01-01",  // ✅ Virtual retorna startDate
  "startDate": "2025-01-01"      // ✅ Campo real
}
```

Recomendação: Atualizar clientes gradualmente até v2.5.

### Q: Posso migrar parcialmente (por empresa, por região)?
**A:** Sim! Use filtros:
```bash
# Por empresa
npm run migrate:alugueis -- --empresa=64abc123...

# Por data
npm run migrate:alugueis -- --after=2025-01-01

# Limite
npm run migrate:alugueis -- --limit=1000
```

(Nota: Filtros customizados requerem modificação do script)

---

## 8. Suporte e Problemas

### Logs de Migração
```bash
# Logs detalhados em
logs/migration-$(date +%Y%m%d).log

# Filtrar apenas erros
grep ERROR logs/migration-*.log
```

### Reportar Problemas

Se encontrar inconsistências:

1. **Documentar:**
   - ID do aluguel afetado
   - Valores antes/depois
   - Logs relevantes

2. **Verificar:**
   ```javascript
   db.aluguels.findOne({ _id: ObjectId('...') })
   ```

3. **Contato:**
   - Email: dev-team@empresa.com
   - Slack: #backend-support
   - Ticket: JIRA PROJECT-XXX

---

## 9. Checklist de Migração

### Pré-Migração
- [ ] Backup completo realizado
- [ ] Dry-run executado com sucesso
- [ ] Número de documentos confirmado
- [ ] Sistema de staging testado
- [ ] Plano de rollback revisado
- [ ] Time avisado sobre manutenção

### Durante Migração
- [ ] Sistema em manutenção (ou baixo tráfego)
- [ ] Logs sendo monitorados
- [ ] MongoDB performance OK
- [ ] Sem erros críticos

### Pós-Migração
- [ ] Validação de dados (queries manuais)
- [ ] Testes de integração passando
- [ ] APIs respondendo corretamente
- [ ] Performance sem degradação
- [ ] Logs sem warnings inesperados
- [ ] Documentação atualizada
- [ ] Time notificado de conclusão

---

## 10. Referências

- [TAREFA_4_ALUGUEL_MODEL_CLEANUP_COMPLETE.md](./TAREFA_4_ALUGUEL_MODEL_CLEANUP_COMPLETE.md)
- [Aluguel Model](../src/models/Aluguel.ts)
- [Period Types](../src/utils/periodTypes.ts)
- [Migration Script](../scripts/migrate-alugueis-to-unified-period.ts)

---

**Última Atualização:** 27/11/2025  
**Versão do Sistema:** 2.0.0  
**Status:** ✅ Produção
