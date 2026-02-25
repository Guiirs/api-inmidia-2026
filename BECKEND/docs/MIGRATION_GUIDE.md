# Guia de Migração - TAREFA 1: Tipagem Global do Express

## ✅ O que foi feito

### 1. Extensão Global da Interface Request
Arquivo: `src/types/express.d.ts`

```typescript
declare global {
  namespace Express {
    interface Request {
      user?: IUserPayload;      // JWT authenticated user
      admin?: IAdminPayload;     // Admin user
      empresa?: { ... };         // API Key empresa
    }
  }
}
```

### 2. Interface IUserPayload Atualizada
- ✅ `empresaId` agora é **obrigatório** (removido `?`)
- ✅ Garante type safety em toda a aplicação

## 🔄 Como Migrar seus Controllers

### ❌ ANTES (usando type assertion)
```typescript
import { IAuthRequest } from '../types/express';

const myController = (req: IAuthRequest, res: Response) => {
  const empresaId = (req.user as any).empresaId;  // Type assertion
  const userId = req.user!.id;                     // Non-null assertion
};
```

### ✅ DEPOIS (usando tipagem global)
```typescript
import { Request, Response } from 'express';

const myController = (req: Request, res: Response) => {
  // Verificação explícita
  if (!req.user) {
    throw new AppError('Usuário não autenticado', 401);
  }

  // Agora TypeScript sabe os tipos corretos!
  const empresaId: string = req.user.empresaId;  // ✅ Type safe
  const userId: string = req.user.id;            // ✅ Type safe
  const email: string = req.user.email;          // ✅ Type safe
};
```

## 📋 Checklist de Migração

Para cada controller/middleware:

1. ✅ Substituir `IAuthRequest` por `Request`
2. ✅ Remover `(req.user as any)`
3. ✅ Remover `req.user!.` (non-null assertion)
4. ✅ Adicionar verificação `if (!req.user)` onde necessário
5. ✅ Compilar e verificar erros de tipo

## 🎯 Próximos Passos

- [ ] **TAREFA 2**: Implementação de DTOs com Zod (aluguelController)
- [ ] **TAREFA 3**: Refatoração do AluguelService
- [ ] **TAREFA 4**: Limpeza do Model Aluguel

## 🔍 Exemplo Completo

```typescript
import { Request, Response, NextFunction } from 'express';
import { aluguelService } from '../services/aluguelService';
import AppError from '../utils/AppError';

export const createAluguel = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Type guard
    if (!req.user) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Agora temos type safety completo
    const empresaId: string = req.user.empresaId;
    const userId: string = req.user.id;
    
    const aluguel = await aluguelService.createAluguel({
      ...req.body,
      empresaId,
      createdBy: userId
    });

    res.status(201).json({ success: true, data: aluguel });
  } catch (error) {
    next(error);
  }
};
```

## 📝 Notas Importantes

- ✅ O middleware `authenticateToken` garante que `req.user` existe nas rotas protegidas
- ✅ Use type guards (`if (!req.user)`) para satisfazer o TypeScript strict mode
- ✅ `empresaId` é obrigatório - se faltar, é erro no token (401/403)
