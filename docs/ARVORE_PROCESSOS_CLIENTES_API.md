# Arvore de Processos - API de Clientes

Objetivo: padronizar o fluxo de `adicao`, `atualizacao` e `remocao` de clientes na API e facilitar diagnostico de erros.

## Visao geral (rotas ativas)

- `POST /api/v1/clientes` -> criar cliente
- `PUT /api/v1/clientes/:id` -> atualizar cliente
- `DELETE /api/v1/clientes/:id` -> remover cliente
- Modulo ativo: `@modules/clientes/cliente.routes` (registrado em `BECKEND/src/gateway/module-registry.ts`)

## Arvore de processos (CRUD)

```text
Clientes API
├─ 1. Entrada HTTP (Routes)
│  ├─ Autenticacao obrigatoria (authenticateToken)
│  ├─ Upload opcional de logo (multipart/json)
│  ├─ Validacao basica de rota/body (express-validator)
│  └─ Encaminhamento para Controller
├─ 2. Controller (orquestracao)
│  ├─ Extrai contexto do usuario (empresaId, userId)
│  ├─ Chama Service (create/update/delete)
│  ├─ Traduz Result Pattern -> HTTP status
│  ├─ Retorna erros com detalhes (`errors[]` quando validacao)
│  └─ Invalida cache `clientes:empresa:{empresaId}:*` em mutacoes
├─ 3. Service (regras de negocio)
│  ├─ Validacao Zod (DTO)
│  ├─ Normalizacao de payload
│  │  ├─ strings vazias -> undefined
│  │  ├─ `cnpj`/`cpf` -> `cpfCnpj`
│  │  └─ documento normalizado em digitos
│  ├─ Regras de logo (validacao + remocao segura em update/delete)
│  ├─ Regras de dependencia (delete)
│  │  ├─ alugeis ativos/futuros
│  │  ├─ propostas internas
│  │  └─ contratos
│  └─ Chama Repository
└─ 4. Repository (persistencia)
   ├─ Mongoose model `Cliente`
   ├─ Filtro por `empresaId` (isolamento tenant)
   ├─ Tratamento de duplicate key (ex.: `cpfCnpj` por empresa)
   └─ Retorno padronizado via Result
```

## Fluxo detalhado por operacao

### 1) Adicao (`POST /clientes`)

```text
Request -> Route -> Controller.create
  -> Service.validateCreateCliente (Zod)
  -> Service.normalizeCreateData
     -> exige documento (`cpfCnpj` ou `cnpj` ou `cpf`)
     -> converte para `cpfCnpj` (somente digitos)
  -> (opcional) valida logo + define `logo_url`
  -> Repository.create
  -> Cache.clear(clientes da empresa)
  -> Response 201
```

Pontos de erro esperados:

- `400 VALIDATION_ERROR`: campos invalidos (regex, formato, obrigatorio)
- `409 DUPLICATE_KEY`: documento duplicado na mesma empresa
- `500/DB`: falha de persistencia

### 2) Atualizacao (`PUT /clientes/:id`)

```text
Request -> Route -> Controller.update
  -> valida `id`
  -> Service.validateUpdateCliente (Zod)
  -> Service.normalizeUpdateData
     -> se documento enviado, reconstrui `cpfCnpj`
  -> Repository.findById (empresaId + id)
  -> processa logo (troca/remocao)
  -> Repository.update
  -> Cache.clear(clientes da empresa)
  -> Response 200
```

Pontos de erro esperados:

- `400`: `id` invalido ou payload invalido
- `404`: cliente nao encontrado
- `409`: documento duplicado
- `500`: falha de DB/storage

### 3) Remocao (`DELETE /clientes/:id`)

```text
Request -> Route -> Controller.delete
  -> valida `id`
  -> Repository.findById
  -> Service.verificaDependencias
     -> alugueis ativos/futuros
     -> PIs
     -> contratos
  -> remove logo (se existir)
  -> Repository.delete
  -> Cache.clear(clientes da empresa)
  -> Response 204
```

Pontos de erro esperados:

- `404`: cliente nao encontrado
- `409`: cliente com dependencias
- `500`: falha de DB/storage

## Invariantes do modulo (recomendado manter)

- Todo acesso de cliente deve filtrar por `empresaId`
- `cpfCnpj` e o campo canonico de persistencia
- `cnpj` e `cpf` sao aliases de entrada/saida para compatibilidade
- Mutacoes devem invalidar cache de listagem
- Erros de validacao devem retornar `errors[]` com `field` e `message`

## Checklist rapido para diagnostico (quando falhar criar cliente)

- Payload chegou com `cnpj/cpf/cpfCnpj`?
- Campo veio vazio (`\"\"`) e foi tratado?
- Documento duplicado na mesma empresa?
- `req.user.empresaId` existe?
- Erro de upload/logo ocorreu antes do save?
- Schema Mongoose contem todos os campos usados no fluxo?

