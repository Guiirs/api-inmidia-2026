# Sistema Global da API

Sistema centralizado de tipagens, exports, constantes e utilitários da API Backstage.

## 📁 Estrutura

```
src/shared/
├── types/index.ts          # Todas as interfaces e tipos TypeScript
├── constants/index.ts      # Todas as constantes da aplicação
├── globals/index.ts        # Serviços, modelos e helpers globais
└── global/index.ts         # Export central de tudo
```

## 🚀 Uso Básico

### Import Completo

```typescript
import GlobalAPI from '@shared/global';

// Acessar modelos
const cliente = await GlobalAPI.Models.Cliente.findById(id);

// Acessar serviços
const result = await GlobalAPI.Services.ClienteService.create(data, empresaId);

// Acessar constantes
const status = GlobalAPI.Constants.STATUS.ALUGUEL.ATIVO;

// Acessar utilitários
GlobalAPI.Utils.logger.info('Operação realizada');
```

### Import Seletivo (Recomendado)

```typescript
import {
  Models,
  Services,
  AppError,
  logger,
  STATUS,
  HTTP_STATUS,
  successResponse,
  validateObjectId,
  normalizePagination
} from '@shared/global';

// Usar diretamente
const cliente = await Models.Cliente.findById(id);
const result = await Services.ClienteService.create(data, empresaId);

if (!cliente) {
  throw new AppError('Cliente não encontrado', HTTP_STATUS.NOT_FOUND);
}

logger.info('Cliente encontrado');
```

## 📋 Principais Exports

### 1. Modelos (Models)

```typescript
import { Models } from '@shared/global';

// Todos os modelos Mongoose disponíveis
Models.Aluguel
Models.Cliente
Models.Contrato
Models.Empresa
Models.Placa
Models.PropostaInterna
Models.Regiao
Models.User
Models.BiWeek
```

### 2. Serviços (Services)

```typescript
import { Services } from '@shared/global';

// Serviços instanciados e prontos para uso
Services.ClienteService
Services.PlacaService
Services.ContratoService
```

### 3. Constantes (STATUS, ROLES, etc)

```typescript
import { STATUS, ROLES, PERMISSIONS, HTTP_STATUS } from '@shared/global';

// Status de entidades
STATUS.ALUGUEL.ATIVO          // 'ativo'
STATUS.CONTRATO.RASCUNHO      // 'rascunho'
STATUS.PLACA.DISPONIVEL       // 'disponivel'

// Roles de usuário
ROLES.ADMIN                    // 'admin'
ROLES.USER                     // 'user'
ROLES.VIEWER                   // 'viewer'

// Permissões
PERMISSIONS.CLIENTE_CREATE
PERMISSIONS.CONTRATO_GENERATE_PDF

// Status HTTP
HTTP_STATUS.OK                 // 200
HTTP_STATUS.NOT_FOUND         // 404
HTTP_STATUS.INTERNAL_SERVER_ERROR // 500
```

### 4. Mensagens (ERROR_MESSAGES, SUCCESS_MESSAGES)

```typescript
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@shared/global';

throw new AppError(ERROR_MESSAGES.CLIENTE_NOT_FOUND, 404);

res.json(successResponse(data, SUCCESS_MESSAGES.CREATED));
```

### 5. Helpers Globais

```typescript
import {
  successResponse,
  errorResponse,
  normalizePagination,
  validateObjectId,
  validateObjectIds,
  sanitizeInput,
  removeUndefined,
  formatDateBR,
  formatCurrency,
  generateUniqueCode,
  retryWithBackoff,
  chunkArray,
  generateSlug,
  validateDateRange,
  daysDifference
} from '@shared/global';

// Paginação
const { page, limit, skip } = normalizePagination(req.query.page, req.query.limit);

// Validação
validateObjectId(clienteId, 'ClienteId');
validateObjectIds([id1, id2, id3], 'IDs de placas');

// Sanitização
const cleanData = sanitizeInput(req.body, ['nome', 'email', 'telefone']);
const dataWithoutUndefined = removeUndefined(updateData);

// Formatação
const dataBR = formatDateBR(new Date());           // "05/12/2025"
const valor = formatCurrency(1500.50);              // "R$ 1.500,50"

// Utilitários
const codigo = generateUniqueCode('CLI-');          // "CLI-1733123456ABC123"
const slug = generateSlug('Placa Centro SP');       // "placa-centro-sp"

// Datas
validateDateRange(startDate, endDate);
const dias = daysDifference(startDate, endDate);

// Retry com backoff
const result = await retryWithBackoff(async () => {
  return await externalApi.call();
}, 3, 1000);

// Arrays
const chunks = chunkArray([1,2,3,4,5,6,7,8,9], 3); // [[1,2,3], [4,5,6], [7,8,9]]
```

### 6. Middleware Helpers

```typescript
import {
  asyncHandler,
  validateRequiredFields,
  extractEmpresaId
} from '@shared/global';

// Wrapper async para controllers
export const createCliente = asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['nome', 'cpfCnpj', 'telefone']);
  
  const empresaId = extractEmpresaId(req);
  
  const cliente = await Services.ClienteService.create(req.body, empresaId);
  
  res.status(HTTP_STATUS.CREATED).json(successResponse(cliente));
});
```

### 7. Tipos TypeScript

```typescript
import type {
  PaginatedResponse,
  PaginationParams,
  SearchParams,
  ApiResponse,
  ApiError,
  ICliente,
  IPlaca,
  IContrato,
  IAluguel,
  AuthenticatedRequest,
  ControllerFn,
  MiddlewareFn,
  UploadResult,
  UploadOptions,
  ValidationResult,
  ValidationSchema,
  ICrudService
} from '@shared/global';

// Uso em função
const getClientes = async (
  empresaId: string,
  params: SearchParams
): Promise<PaginatedResponse<ICliente>> => {
  // ...
};

// Controller tipado
const createCliente: ControllerFn = async (req, res) => {
  const response: ApiResponse<ICliente> = {
    success: true,
    data: cliente
  };
  res.json(response);
};

// Service com interface
class MeuService implements ICrudService<ICliente> {
  async create(data: Partial<ICliente>, empresaId: string): Promise<ICliente> {
    // ...
  }
  // ... outros métodos
}
```

## 🎯 Exemplos de Uso Completo

### Exemplo 1: Controller de Cliente

```typescript
import {
  Models,
  Services,
  AppError,
  logger,
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  successResponse,
  asyncHandler,
  validateRequiredFields,
  extractEmpresaId,
  normalizePagination,
  validateObjectId
} from '@shared/global';

// Listar clientes
export const listClientes = asyncHandler(async (req, res) => {
  const empresaId = extractEmpresaId(req);
  const { page, limit, skip } = normalizePagination(req.query.page, req.query.limit);
  
  const result = await Services.ClienteService.getAll(empresaId, {
    page,
    limit,
    search: req.query.search as string
  });
  
  res.json(successResponse(result));
});

// Criar cliente
export const createCliente = asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['nome', 'cpfCnpj', 'telefone']);
  
  const empresaId = extractEmpresaId(req);
  
  const cliente = await Services.ClienteService.create(req.body, empresaId);
  
  logger.info(`Cliente criado: ${cliente._id}`, { empresaId, userId: req.user?.id });
  
  res.status(HTTP_STATUS.CREATED).json(
    successResponse(cliente, SUCCESS_MESSAGES.CREATED)
  );
});

// Buscar por ID
export const getClienteById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateObjectId(id, 'ClienteId');
  
  const empresaId = extractEmpresaId(req);
  
  const cliente = await Services.ClienteService.getById(id, empresaId);
  
  if (!cliente) {
    throw new AppError(ERROR_MESSAGES.CLIENTE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }
  
  res.json(successResponse(cliente));
});

// Atualizar
export const updateCliente = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateObjectId(id, 'ClienteId');
  
  const empresaId = extractEmpresaId(req);
  
  const cliente = await Services.ClienteService.update(id, req.body, empresaId);
  
  logger.info(`Cliente atualizado: ${id}`, { empresaId });
  
  res.json(successResponse(cliente, SUCCESS_MESSAGES.UPDATED));
});

// Deletar
export const deleteCliente = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateObjectId(id, 'ClienteId');
  
  const empresaId = extractEmpresaId(req);
  
  await Services.ClienteService.delete(id, empresaId);
  
  logger.info(`Cliente deletado: ${id}`, { empresaId });
  
  res.status(HTTP_STATUS.NO_CONTENT).send();
});
```

### Exemplo 2: Service Custom

```typescript
import {
  Models,
  AppError,
  logger,
  HTTP_STATUS,
  ERROR_MESSAGES,
  validateObjectId,
  normalizePagination,
  removeUndefined,
  handleMongooseError,
  type PaginatedResponse,
  type SearchParams,
  type IAluguel
} from '@shared/global';

export class AluguelService {
  
  async create(data: Partial<IAluguel>, empresaId: string): Promise<IAluguel> {
    try {
      validateObjectId(empresaId, 'EmpresaId');
      validateObjectId(data.clienteId as string, 'ClienteId');
      validateObjectId(data.placaId as string, 'PlacaId');
      
      // Verifica se placa está disponível
      const placa = await Models.Placa.findById(data.placaId);
      if (!placa || !placa.disponivel) {
        throw new AppError(ERROR_MESSAGES.PLACA_NOT_AVAILABLE, HTTP_STATUS.BAD_REQUEST);
      }
      
      // Cria aluguel
      const aluguel = await Models.Aluguel.create({
        ...data,
        empresaId
      });
      
      // Atualiza status da placa
      await Models.Placa.findByIdAndUpdate(data.placaId, {
        disponivel: false,
        statusAluguel: 'alugada'
      });
      
      logger.info(`Aluguel criado: ${aluguel._id}`, { empresaId });
      
      return aluguel;
      
    } catch (error) {
      if (error instanceof AppError) throw error;
      
      const mongoError = handleMongooseError(error);
      logger.error(`Erro ao criar aluguel: ${mongoError.message}`, { error, empresaId });
      
      throw new AppError(mongoError.message, mongoError.statusCode);
    }
  }
  
  async getAll(empresaId: string, params: SearchParams): Promise<PaginatedResponse<IAluguel>> {
    try {
      validateObjectId(empresaId, 'EmpresaId');
      
      const { page, limit, skip } = normalizePagination(params.page, params.limit);
      
      const query: any = { empresaId };
      if (params.status) query.status = params.status;
      if (params.clienteId) query.clienteId = params.clienteId;
      
      const [data, totalDocs] = await Promise.all([
        Models.Aluguel.find(query)
          .populate('clienteId', 'nome')
          .populate('placaId', 'numero_placa')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Models.Aluguel.countDocuments(query)
      ]);
      
      const totalPages = Math.ceil(totalDocs / limit);
      
      return {
        data,
        pagination: {
          totalDocs,
          totalPages,
          currentPage: page,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
      
    } catch (error) {
      const mongoError = handleMongooseError(error);
      logger.error(`Erro ao listar aluguéis: ${mongoError.message}`, { error, empresaId });
      throw new AppError(mongoError.message, mongoError.statusCode);
    }
  }
}
```

## 🔧 Configurações

### Config Object

```typescript
import { Config } from '@shared/global';

// Paginação
Config.pagination.defaultLimit    // 10
Config.pagination.maxLimit        // 100

// Upload
Config.upload.maxFileSize         // 5MB
Config.upload.allowedImageTypes   // ['image/jpeg', 'image/png', ...]

// Cache
Config.cache.defaultTTL           // 3600s (1h)
Config.cache.shortTTL             // 300s (5min)
Config.cache.longTTL              // 86400s (24h)

// JWT
Config.jwt.expiresIn              // '7d'
Config.jwt.refreshExpiresIn       // '30d'
```

## 📝 Validação e Helpers de Tipo

```typescript
import {
  isValidObjectId,
  toObjectId,
  isValidEmail,
  isValidCNPJ,
  isValidCPF,
  type ObjectId
} from '@shared/global';

// Validações
if (isValidObjectId(id)) {
  const objectId: ObjectId = toObjectId(id);
}

if (!isValidEmail(email)) {
  throw new AppError('Email inválido', 400);
}

if (!isValidCNPJ(cnpj)) {
  throw new AppError('CNPJ inválido', 400);
}
```

## 🎨 Boas Práticas

1. **Sempre importe do @shared/global** ao invés de caminhos relativos
2. **Use tipos TypeScript** para melhor intellisense
3. **Use constantes** ao invés de strings mágicas
4. **Valide IDs** antes de queries no banco
5. **Use asyncHandler** para controllers
6. **Use logger** para logs consistentes
7. **Use AppError** para erros customizados
8. **Use helpers** para código reutilizável

## 📚 Referências

- Tipos: `src/shared/types/index.ts`
- Constantes: `src/shared/constants/index.ts`
- Globals: `src/shared/globals/index.ts`
- Export Central: `src/shared/global/index.ts`
