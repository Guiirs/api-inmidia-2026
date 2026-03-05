/**
 * Admin Routes
 * Rotas administrativas
 */
import { Router } from 'express';
import { z } from 'zod';
import logger from '../../shared/container/logger';
import * as adminController from './admin.controller';
import authenticateToken from '../../shared/infra/http/middlewares/auth.middleware';
import adminAuthMiddleware from '../../shared/infra/http/middlewares/admin-auth.middleware';
import { validate } from '@shared/infra/http/middlewares/validate.middleware';

const router = Router();

logger.info('[Routes Admin] Definindo rotas de Administracao...');

const mongoIdRegex = /^[0-9a-fA-F]{24}$/;

const userCreationSchema = z.object({
  body: z.object({
    username: z.string().trim().min(3).max(50),
    email: z.string().email().max(100),
    password: z.string().min(6),
    nome: z.string().trim().min(1).max(100),
    sobrenome: z.string().trim().min(1).max(100),
    role: z.enum(['user', 'admin']).optional(),
  }),
});

const roleUpdateSchema = z.object({
  params: z.object({
    id: z.string().regex(mongoIdRegex, 'O ID do utilizador fornecido e invalido.'),
  }),
  body: z.object({
    role: z.enum(['user', 'admin']),
  }),
});

const idParamSchema = z.object({
  params: z.object({
    id: z.string().regex(mongoIdRegex, 'O ID do utilizador fornecido e invalido.'),
  }),
});

router.use(authenticateToken);
router.use(adminAuthMiddleware);

router.get('/users', adminController.getAllUsers);
router.post('/users', validate(userCreationSchema), adminController.createUser);
router.put('/users/:id/role', validate(roleUpdateSchema), adminController.updateUserRole);
router.delete('/users/:id', validate(idParamSchema), adminController.deleteUser);

logger.info('[Routes Admin] Rotas de Administracao definidas com sucesso.');

export default router;
