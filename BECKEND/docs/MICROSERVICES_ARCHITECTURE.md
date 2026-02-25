# Arquitetura de Microserviços - Backstage API

## 📋 Visão Geral

Este documento descreve a evolução da arquitetura atual (monolito modular) para uma arquitetura de microserviços.

## 🎯 Objetivos

1. **Escalabilidade**: Cada módulo pode escalar independentemente
2. **Manutenibilidade**: Equipes podem trabalhar em módulos diferentes
3. **Resiliência**: Falha em um serviço não derruba todo o sistema
4. **Deploy independente**: Atualizar um módulo sem afetar outros

---

## 🏗️ Fase 1: Monolito Modular (ATUAL)

### Estrutura Atual
```
BECKEND/
├── src/
│   ├── config/           # Configurações globais
│   ├── shared/           # Código compartilhado
│   ├── modules/          # Módulos isolados
│   └── server.ts         # Servidor principal
```

### Módulos Atuais
- ✅ **auth** - Autenticação e autorização
- ✅ **empresas** - Gestão de empresas (multi-tenant)
- ✅ **users** - Gestão de usuários
- ✅ **clientes** - CRM de clientes
- ✅ **placas** - Gestão de placas publicitárias
- ✅ **regioes** - Gestão de regiões
- ✅ **alugueis** - Gestão de aluguéis
- ✅ **propostas-internas** - PIs e orçamentos
- ✅ **contratos** - Gestão de contratos
- ✅ **biweeks** - Sistema de quinzenas
- ✅ **webhooks** - Sistema de webhooks
- ✅ **public-api** - API pública para parceiros

---

## 🚀 Fase 2: Separação em Domínios

### Agrupamento Lógico

#### 1️⃣ **Core Domain** (Núcleo do negócio)
- **empresas** - Multi-tenancy
- **users** - Gestão de usuários
- **auth** - Autenticação/Autorização

**Porta sugerida**: 3001  
**Banco de dados**: Compartilhado (users, empresas)

---

#### 2️⃣ **Asset Management** (Gestão de ativos)
- **placas** - CRUD de placas
- **regioes** - Gestão de regiões

**Porta sugerida**: 3002  
**Banco de dados**: Separado (placas, regioes)  
**Dependências**: Core (empresaId, validação)

---

#### 3️⃣ **CRM Domain** (Relacionamento com clientes)
- **clientes** - CRUD de clientes
- **alugueis** - Gestão de aluguéis

**Porta sugerida**: 3003  
**Banco de dados**: Separado (clientes, alugueis)  
**Dependências**: Core, Asset Management

---

#### 4️⃣ **Sales & Contracts** (Vendas e contratos)
- **propostas-internas** - PIs
- **contratos** - Contratos formais
- **biweeks** - Sistema de períodos

**Porta sugerida**: 3004  
**Banco de dados**: Separado (pis, contratos, bi_weeks)  
**Dependências**: Core, CRM, Asset Management

---

#### 5️⃣ **Integration Layer** (Integrações)
- **webhooks** - Sistema de webhooks
- **public-api** - API pública
- **whatsapp** - Integração WhatsApp

**Porta sugerida**: 3005  
**Banco de dados**: Separado (webhooks, logs)  
**Dependências**: Todos os domínios

---

#### 6️⃣ **Analytics & Reports** (Análise e relatórios)
- **relatorios** - Dashboards e relatórios
- **audit** - Auditoria e logs

**Porta sugerida**: 3006  
**Banco de dados**: Read-only replicas  
**Dependências**: Acesso somente-leitura aos outros bancos

---

## 🌐 Fase 3: API Gateway

### Responsabilidades do Gateway
1. **Roteamento**: Direcionar requisições para o serviço correto
2. **Autenticação**: Validar JWT antes de encaminhar
3. **Rate Limiting**: Controle de taxa por empresa
4. **Logging**: Log centralizado
5. **Circuit Breaker**: Proteção contra serviços caídos

### Exemplo de Roteamento
```
/api/v1/empresas/*     → Core Service (3001)
/api/v1/users/*        → Core Service (3001)
/api/v1/auth/*         → Core Service (3001)

/api/v1/placas/*       → Asset Service (3002)
/api/v1/regioes/*      → Asset Service (3002)

/api/v1/clientes/*     → CRM Service (3003)
/api/v1/alugueis/*     → CRM Service (3003)

/api/v1/pis/*          → Sales Service (3004)
/api/v1/contratos/*    → Sales Service (3004)

/api/v1/webhooks/*     → Integration Service (3005)
/api/v1/public/*       → Integration Service (3005)

/api/v1/relatorios/*   → Analytics Service (3006)
```

---

## 🔄 Fase 4: Comunicação Entre Serviços

### Padrões de Comunicação

#### **Síncrona** (REST/gRPC)
- Para operações críticas que precisam de resposta imediata
- Exemplo: Validar se cliente existe antes de criar PI

#### **Assíncrona** (Message Queue - RabbitMQ/Redis)
- Para operações que não precisam de resposta imediata
- Exemplo: Enviar webhook quando PI é aprovada

### Event-Driven Architecture
```javascript
// Exemplo: PI criada
Sales Service → Publica evento "pi.created"
                ↓
         [Message Broker]
                ↓
    ┌───────────┴───────────┐
    ↓                       ↓
Webhooks Service      Analytics Service
(dispara webhook)     (atualiza dashboard)
```

---

## 📦 Fase 5: Banco de Dados

### Estratégia de Database per Service

#### Opção A: Database Compartilhado (atual)
- ✅ Simples de implementar
- ✅ Transações ACID
- ❌ Acoplamento forte

#### Opção B: Database por Serviço
- ✅ Independência total
- ✅ Cada serviço escolhe sua tecnologia
- ❌ Complexidade em transações distribuídas
- ❌ Requer Saga Pattern

#### Recomendação: Híbrida
- **Core**: MongoDB compartilhado (users, empresas)
- **Asset Management**: MongoDB separado
- **CRM**: MongoDB separado
- **Analytics**: PostgreSQL (melhor para agregações)

---

## 🛠️ Tecnologias Sugeridas

### API Gateway
- **Express Gateway** - Simples e baseado em Express
- **Kong** - Robusto, open-source
- **AWS API Gateway** - Cloud-native

### Message Broker
- **RabbitMQ** - Confiável, features robustas
- **Redis Pub/Sub** - Simples, rápido
- **Apache Kafka** - High throughput

### Service Discovery
- **Consul** - Service discovery + config
- **etcd** - Key-value store distribuído

### Monitoring
- **Prometheus + Grafana** - Métricas
- **ELK Stack** - Logs centralizados
- **Jaeger** - Distributed tracing

---

## 📝 Plano de Migração

### Etapa 1: Preparação (2-4 semanas)
1. ✅ Isolar módulos em pastas separadas (JÁ FEITO)
2. ⏳ Definir contratos de API (OpenAPI/Swagger)
3. ⏳ Implementar feature flags
4. ⏳ Criar testes de integração

### Etapa 2: API Gateway (1-2 semanas)
1. Implementar gateway básico
2. Migrar autenticação para o gateway
3. Testar roteamento

### Etapa 3: Extração do primeiro serviço (2-3 semanas)
1. Começar com serviço de menor dependência (ex: Webhooks)
2. Criar repositório separado
3. Implementar comunicação assíncrona
4. Deploy e monitoramento

### Etapa 4: Migração gradual (3-6 meses)
1. Um serviço por sprint
2. Manter backward compatibility
3. Monitorar performance

---

## 🎯 Decisão: Quando Migrar?

### Migrar para Microserviços SE:
✅ Equipe > 10 desenvolvedores  
✅ Diferentes partes do sistema precisam escalar diferentemente  
✅ Deploys frequentes são necessários  
✅ Equipes independentes trabalhando em módulos diferentes  

### Manter Monolito Modular SE:
✅ Equipe pequena (< 10 devs)  
✅ Sistema ainda em crescimento  
✅ Complexidade de infraestrutura é um problema  
✅ Latência entre serviços é crítica  

---

## 📊 Próximos Passos Recomendados

1. **Documentar APIs** - Criar OpenAPI specs para cada módulo
2. **Implementar API Gateway** - Mesmo no monolito, para preparar migração
3. **Message Queue** - Implementar eventos assíncronos internos
4. **Monitoramento** - Métricas por módulo
5. **Testes E2E** - Garantir que separação não quebre funcionalidades

---

## 🔗 Referências

- [Microservices Patterns](https://microservices.io/patterns/)
- [Building Microservices by Sam Newman](https://www.oreilly.com/library/view/building-microservices/9781491950340/)
- [API Gateway Pattern](https://docs.microsoft.com/en-us/azure/architecture/microservices/design/gateway)
