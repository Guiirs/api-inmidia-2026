# 📊 Sistema de Logs Otimizado

O sistema de logs foi otimizado para reduzir informações desnecessárias em desenvolvimento.

## 🎯 Níveis de Log

### Desenvolvimento (NODE_ENV=development)
- **debug**: Informações detalhadas (filtradas por padrão)
- **info**: Informações importantes
- **warn**: Avisos
- **error**: Erros

### Produção (NODE_ENV=production)
- **warn**: Apenas avisos
- **error**: Apenas erros

## 🔧 Variáveis de Ambiente

### LOG_HTTP
Habilita logs detalhados de todas as requisições HTTP.

```env
LOG_HTTP=false  # Padrão (desabilitado)
LOG_HTTP=true   # Ativa logs HTTP
```

**Exemplo de saída:**
```
2025-12-04 12:00:00 http: GET /api/v1/contratos 200 45ms
```

### LOG_GATEWAY
Habilita logs detalhados do API Gateway (rotas, módulos, timing).

```env
LOG_GATEWAY=false  # Padrão (desabilitado)
LOG_GATEWAY=true   # Ativa logs do Gateway
```

**Exemplo de saída:**
```
2025-12-04 12:00:00 info: [Gateway] GET /api/v1/contratos → contratos
2025-12-04 12:00:00 info: [Gateway] GET /api/v1/contratos → contratos - 200 (45ms)
```

## 📝 Logs Filtrados Automaticamente

Os seguintes logs são **silenciados por padrão** em desenvolvimento:

- ✅ Requisições individuais do Gateway
- ✅ Métricas de performance de cada request
- ✅ Debug de BiWeekHelpers
- ✅ Debug de PeriodService
- ✅ Debug de QueueService

## 🎨 O Que Você Verá Por Padrão

### ✅ Sempre Visível
```
🚀 [Gateway] Carregando módulos...
✅ [Gateway] 15 módulos ativos
✅ [Server] API iniciada na porta 4000
⚠️ [Redis] Redis DESATIVADO temporariamente
❌ [Error] Erro ao processar requisição
```

### ⚠️ Avisos e Erros
```
2025-12-04 12:00:00 warn: [Gateway] GET /api/v1/invalid → 404 (5ms)
2025-12-04 12:00:00 error: [Gateway] GET /api/v1/crash → 500 (100ms) - FALHA
```

## 🚀 Modo Debug Completo

Para desenvolvimento com logs completos:

```env
NODE_ENV=development
LOG_HTTP=true
LOG_GATEWAY=true
```

## 📁 Arquivos de Log

### logs/error.log
Apenas erros (level: error)

### logs/all.log
Todos os logs de info ou superior (não inclui debug)

## 💡 Exemplos de Uso

### Desenvolvimento Normal (Quieto)
```env
# .env
NODE_ENV=development
LOG_HTTP=false
LOG_GATEWAY=false
```

Resultado: Logs mínimos, apenas eventos importantes e erros.

### Desenvolvimento com Debug
```env
# .env
NODE_ENV=development
LOG_HTTP=true
LOG_GATEWAY=true
```

Resultado: Todos os logs ativos, útil para troubleshooting.

### Produção
```env
# .env
NODE_ENV=production
```

Resultado: Apenas warns e erros, máxima performance.

## 🔍 Filtros Customizados

Para adicionar mais filtros, edite `src/shared/container/logger.ts`:

```typescript
const silencedPatterns = [
  /\[Gateway\].*→.*- \d{3}/,  // Requisições Gateway
  /\[Metrics\].*\d+\.\d{3}s/, // Métricas
  /\[SeuModulo\].*debug/,     // Seu módulo aqui
];
```

## 📊 Benefícios

- ✅ **Console limpo**: Foco no que importa
- ✅ **Performance**: Menos I/O de logs
- ✅ **Flexibilidade**: Ativa debug quando precisar
- ✅ **Produção segura**: Automático em prod
- ✅ **Troubleshooting fácil**: Flags de debug simples
