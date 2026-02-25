# Redis + API Startup

Este projeto agora inclui scripts para gerenciar o Redis automaticamente junto com a API.

## 🚀 Comandos Disponíveis

### Iniciar API com Redis
```bash
npm run dev:redis
```

Este comando irá:
1. ✅ Verificar se o Docker está rodando
2. ✅ Iniciar um container Redis na porta 6380
3. ✅ Iniciar a API em modo desenvolvimento

### Iniciar API sem Redis
```bash
npm run dev
```

A API funcionará normalmente, mas sem o sistema de filas BullMQ (fallback automático).

### Parar o Redis
```bash
npm run redis:stop
```

## ⚠️ Pré-requisitos

- **Docker Desktop** instalado e **RODANDO**
- Porta 6380 disponível

## 📋 Verificar status do Redis

```powershell
# Verificar se o container está rodando
docker ps | Select-String "backstage-redis"

# Ver logs do Redis
docker logs backstage-redis

# Conectar ao Redis CLI
docker exec -it backstage-redis redis-cli
```

## 🔧 Configuração

O Redis está configurado para:
- **Porta**: 6380 (mapeada da porta padrão 6379 do container)
- **Host**: localhost
- **Imagem**: redis:alpine (leve e otimizada)
- **Restart Policy**: unless-stopped (reinicia automaticamente)

## 🐛 Troubleshooting

### ❌ Docker não está instalado
Baixe e instale o [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### ❌ "Docker Desktop não está rodando"
1. Abra o Docker Desktop
2. Aguarde até aparecer "Docker Desktop is running"
3. Execute `npm run dev:redis` novamente

### ❌ Porta 6380 já está em uso
Edite o arquivo `start-with-redis.ps1` e mude a porta:
```powershell
-p 6381:6379 `  # Mude 6380 para outra porta
```

Também atualize o arquivo `.env`:
```env
REDIS_PORT=6381
```

### 🗑️ Remover completamente o Redis
```powershell
docker stop backstage-redis
docker rm backstage-redis
```

## 📊 Benefícios do Redis

Com o Redis ativo, você terá:
- ✅ Sistema de filas para geração de PDFs
- ✅ Processamento assíncrono
- ✅ Melhor performance
- ✅ Retry automático em caso de falhas
- ✅ Dashboard de monitoramento (BullMQ)

