/**
 * User Routes
 * Rotas HTTP com Dependency Injection
 */

import { Router } from 'express';
import { z } from 'zod';
import User from './User';
import { UserRepository } from './repositories/user.repository';
import { UserService } from './services/user.service';
import { UserController } from './controllers/user.controller';
import authenticateToken from '@middlewares/auth.middleware';
import {
  regenerateApiKeyLimiter,
  authRateLimiter,
} from '@shared/infra/http/middlewares/rate-limit.middleware';
import { validate } from '@shared/infra/http/middlewares/validate.middleware';
import { UpdateUserProfileSchema } from './dtos/user.dto';

const router = Router();

// Dependency Injection - Novo (refatorado)
const repository = new UserRepository(User);
const service = new UserService(repository);
const controller = new UserController(service);

const updateProfileSchema = z.object({
  body: UpdateUserProfileSchema,
});

const regenerateApiKeySchema = z.object({
  body: z.object({
    password: z.string().trim().min(1, 'A senha atual e obrigatoria para regenerar a chave.'),
  }),
});

// Todas as rotas requerem autenticacao
router.use(authenticateToken);

// GET /api/v1/user/me - Perfil do Utilizador
router.get('/me', (req, res, next) => controller.getProfile(req, res, next));

// GET /api/v1/user/me/empresa - Perfil da Empresa
router.get('/me/empresa', (req, res, next) => controller.getEmpresaProfile(req, res, next));

// PUT /api/v1/user/me - Atualizar Perfil do Utilizador
router.put('/me', validate(updateProfileSchema), (req, res, next) => controller.updateProfile(req, res, next));

// POST /api/v1/user/me/empresa/regenerate-api-key - Regenerar API Key
router.post(
  '/me/empresa/regenerate-api-key',
  authRateLimiter,
  regenerateApiKeyLimiter,
  validate(regenerateApiKeySchema),
  (req, res, next) => controller.regenerateEmpresaApiKey(req, res, next)
);

// Rotas refatoradas (mantidas para compatibilidade)
// GET /api/v1/users/profile - Busca perfil do usuario
router.get('/profile', (req, res, next) => controller.getProfile(req, res, next));

// PATCH /api/v1/users/profile - Atualiza perfil do usuario
router.patch('/profile', validate(updateProfileSchema), (req, res, next) => controller.updateProfile(req, res, next));

export default router;
