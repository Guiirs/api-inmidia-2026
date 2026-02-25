# API Gateway - Guia de Uso

## 📋 Visão Geral

O API Gateway é uma camada de abstração que centraliza o roteamento, monitoramento e controle de todos os módulos da API. Ele implementa padrões essenciais para preparar a aplicação para migração para microserviços.

## 🎯 Funcionalidades

### 1. **Registro Automático de Módulos**
Todos os módulos são registrados automaticamente através do `module-registry.ts`. Não é mais necessário adicionar manualmente cada rota no `app.ts`.

### 2. **Circuit Breaker**
Proteção contra falhas em cascata. Se um módulo falhar 5 vezes consecutivas, ele entra em estado "open" por 60 segundos.

```
Estado: CLOSED → funcionamento normal
Estado: OPEN → módulo temporariamente desativado
Estado: HALF_OPEN → testando recuperação
```

### 3. **Rate Limiting por Módulo**
Cada módulo pode ter seu próprio limite de requisições:

```typescript
// Exemplo no gateway.config.ts
{
  path: '/api/v1/auth',
  module: 'auth',
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100 // 100 requests por IP
  }
}
```

### 4. **Monitoramento e Logs**
Todas as requisições são interceptadas e logadas com:
- Tempo de resposta
- Status HTTP
- Módulo acessado
- Circuit breaker state

### 5. **Métricas**
Headers automáticos em cada resposta:
- `X-Gateway-Module`: Módulo que processou a requisição
- `X-Response-Time`: Tempo de processamento em ms

## 📍 Endpoints do Gateway

### **GET /api/v1/gateway/info**
Retorna informações sobre todos os módulos registrados.

**Response:**
```json
{
  "totalModules": 16,
  "enabledModules": 16,
  "disabledModules": 0,
  "domains": {
    "core": 4,
    "asset-management": 2,
    "crm": 2,
    "sales": 3,
    "integration": 3,
    "analytics": 1,
    "system": 1
  },
  "modules": [
    {
      "name": "auth",
      "basePath": "/api/v1/auth",
      "domain": "core",
      "version": "1.0.0",
      "enabled": true,
      "description": "Sistema de autenticação e autorização"
    }
    // ... outros módulos
  ]
}
```

## 🏗️ Organização por Domínios

### **Core (Sistema Base)**
- `auth` - Autenticação e autorização
- `users` - Gerenciamento de usuários
- `empresas` - Gerenciamento de empresas
- `admin` - Painel administrativo

### **Asset Management (Gestão de Ativos)**
- `placas` - Gerenciamento de placas
- `regioes` - Gerenciamento de regiões

### **CRM (Relacionamento com Cliente)**
- `clientes` - Gestão de clientes
- `alugueis` - Gestão de aluguéis

### **Sales (Vendas e Contratos)**
- `propostas-internas` - Propostas internas (PIs)
- `contratos` - Gestão de contratos
- `biweeks` - Gestão quinzenal

### **Integration (Integrações Externas)**
- `webhooks` - Webhooks de integração
- `public-api` - API pública (API Key)
- `whatsapp` - Integração WhatsApp

### **Analytics (Análise e Relatórios)**
- `relatorios` - Sistema de relatórios

### **System (Utilitários do Sistema)**
- `checking` - Health checks e validações

## 🔧 Como Adicionar um Novo Módulo

### 1. Criar o módulo na estrutura padrão
```
src/modules/meu-modulo/
├── meu-modulo.routes.ts
├── meu-modulo.controller.ts
├── meu-modulo.service.ts
└── meu-modulo.validator.ts
```

### 2. Registrar no module-registry.ts
```typescript
{
  name: 'meu-modulo',
  basePath: '/api/v1/meu-modulo',
  router: meuModuloRoutes,
  description: 'Descrição do módulo',
  domain: 'core', // ou outro domínio apropriado
  version: '1.0.0',
  enabled: true
}
```

### 3. (Opcional) Adicionar configuração específica no gateway.config.ts
```typescript
{
  path: '/api/v1/meu-modulo',
  target: 'http://localhost:3000',
  module: 'meu-modulo',
  requiresAuth: true,
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 200
  }
}
```

**Pronto!** O módulo será automaticamente registrado na próxima inicialização.

## 🚀 Preparação para Microserviços

O Gateway já está preparado para migração incremental:

### Fase 1: Monólito Modular (ATUAL)
```
Gateway → Express App → Módulos
```

### Fase 2: Extração de Serviços
```
Gateway → Express App (Core) + Microserviço (Módulo Extraído)
```

### Fase 3: Microserviços Completo
```
Gateway → Microserviço 1 + Microserviço 2 + ... + Microserviço N
```

### Como Extrair um Módulo

1. **Configurar target no gateway.config.ts**
```typescript
{
  path: '/api/v1/modulo',
  target: 'http://microservico-modulo:4000', // URL do novo serviço
  module: 'modulo',
  requiresAuth: true
}
```

2. **Adicionar proxy no gateway.middleware.ts** (futuro)
```typescript
// Gateway automaticamente roteia para o target configurado
```

3. **Desabilitar módulo local**
```typescript
// No module-registry.ts
{
  name: 'modulo',
  enabled: false // Desabilita local, usa target remoto
}
```

## 📊 Monitoramento

### Verificar Estado do Circuit Breaker
```bash
# Em desenvolvimento, adicione logs:
logger.info('[Gateway] Circuit state:', circuitState);
```

### Verificar Tempo de Resposta
```bash
# Headers da resposta:
X-Response-Time: 45ms
X-Gateway-Module: auth
```

### Verificar Módulos Registrados
```bash
curl http://localhost:3000/api/v1/gateway/info
```

## 🔒 Segurança

### Rate Limiting Global
Configurado em `app.ts`:
```typescript
// 100 requests por 15 minutos por IP
globalRateLimiter
```

### Rate Limiting por Módulo
Configurado no `gateway.config.ts` para cada rota.

### Circuit Breaker
Protege contra:
- Módulos com bugs
- Dependências externas lentas
- Sobrecarga de requisições

## 📝 Logs

### Formato dos Logs
```
[Gateway] Module 'auth' registered at /api/v1/auth
[Gateway] Total modules: 16 | Enabled: 16 | Disabled: 0
[Gateway] Modules by domain - core: 4, asset-management: 2, ...
```

### Níveis de Log
- `info`: Inicialização e registro de módulos
- `warn`: Circuit breaker aberto, rate limit atingido
- `error`: Falhas em módulos, timeouts

## 🎓 Próximos Passos

1. ✅ Gateway básico implementado
2. ⏳ Implementar proxy para targets remotos
3. ⏳ Adicionar autenticação centralizada no gateway
4. ⏳ Implementar distributed tracing (Jaeger/Zipkin)
5. ⏳ Service discovery automático
6. ⏳ Load balancing entre instâncias

## 📚 Referências

- [MICROSERVICES_ARCHITECTURE.md](./MICROSERVICES_ARCHITECTURE.md) - Arquitetura completa
- [gateway/gateway.config.ts](../src/gateway/gateway.config.ts) - Configuração de rotas
- [gateway/module-registry.ts](../src/gateway/module-registry.ts) - Registro de módulos
- [gateway/bootstrap.ts](../src/gateway/bootstrap.ts) - Inicialização do gateway
