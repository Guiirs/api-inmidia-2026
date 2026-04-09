# Backend API

## Descrição
API backend para o sistema Inmidia, construída com Node.js, Express, TypeScript e MongoDB.

## Instalação

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure as variáveis de ambiente no arquivo `.env` (veja `.env.example`).

3. Execute as migrações:
   ```bash
   npm run migrate
   ```

## Desenvolvimento

```bash
npm run dev
```

## Produção

```bash
npm run build
npm start
```

## Deploy no Railway

1. Conecte o repositório GitHub ao Railway.
2. Configure as variáveis de ambiente no painel do Railway.
3. O deploy será automático a cada push.

Variáveis essenciais:
- `MONGODB_URI`
- `JWT_SECRET`
- `PORT` (definido automaticamente pelo Railway)
- `CORS_ORIGIN` (URL do frontend)
- Outras conforme `.env.example`