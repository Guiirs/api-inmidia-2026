# ⚠️ Redis Temporariamente Desativado

O Redis foi desativado temporariamente para evitar erros de conexão durante o desenvolvimento.

## Como Reativar o Redis

### Passo 1: Habilitar no código

Edite o arquivo `src/config/redis.ts` e mude a flag:

```typescript
// ⚠️ REDIS TEMPORARIAMENTE DESATIVADO
const REDIS_ENABLED = true;  // Mude de false para true
```

### Passo 2: Iniciar o Redis

```bash
npm run dev:redis
```

Ou inicie o Redis manualmente via Docker:

```bash
docker run -d --name backstage-redis -p 6380:6379 --restart unless-stopped redis:alpine
```

### Passo 3: Reiniciar a API

```bash
npm run dev
```

## Status Atual

✅ **API funcionando sem Redis**
- PDFs são gerados diretamente (sem fila)
- WhatsApp funciona normalmente
- Sem erros de conexão

⚠️ **Recursos desativados:**
- Sistema de filas BullMQ
- Processamento assíncrono de PDFs
- Retry automático
- Dashboard de monitoramento

## Modo Fallback

Quando o Redis está desativado:
- `QueueService` detecta automaticamente
- Usa processamento direto (`processPDFJobDirect`)
- Logs indicam: `"⚠️ Redis desativado - processamento direto será usado"`
- Tudo continua funcionando, mas sem filas

## Verificar Status

Para ver se o Redis está ativo, procure no log de inicialização:

```
✅ Redis ativo:
[Redis] Connected successfully
[QueueService] PDF Queue Service initialized

⚠️ Redis desativado:
[Redis] ⚠️ Redis DESATIVADO temporariamente
[QueueService] ⚠️ Redis desativado - processamento direto será usado
```
