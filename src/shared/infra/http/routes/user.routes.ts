import { Router } from 'express';
import { z } from 'zod';
import logger from '@shared/container/logger';
import { regenerateApiKeyLimiter } from '../middlewares/rate-limit.middleware';
import { UserController } from '@modules/users/user.controller';
import UserService from '@modules/users/user.service';
import authenticateToken from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';

const router = Router();

const userService = new UserService();
const userController = new UserController(userService);

if (!authenticateToken) {
  logger.error('[Routes User] ERRO CRITICO: Middleware de autenticacao ausente.');
  throw new Error('Middleware de autenticacao incompleto.');
}

const updateProfileSchema = z.object({
  body: z.object({
    email: z.string().email().max(100).optional(),
    username: z.string().trim().min(3).max(50).optional(),
    password: z.string().min(6).optional(),
    nome: z.string().trim().max(100).optional(),
    sobrenome: z.string().trim().max(100).optional(),
    avatar_url: z.string().url().optional(),
  }),
});

const regenerateApiKeySchema = z.object({
  body: z.object({
    password: z.string().min(1, 'A sua senha atual e obrigatoria para regenerar a chave.'),
  }),
});

router.use(authenticateToken);

router.get('/me', (req, res, next) => userController.getUserProfile(req, res, next));
router.get('/me/empresa', (req, res, next) => userController.getEmpresaProfile(req, res, next));
router.put('/me', validate(updateProfileSchema), (req, res, next) => userController.updateUserProfile(req, res, next));
router.post(
  '/me/empresa/regenerate-api-key',
  regenerateApiKeyLimiter,
  validate(regenerateApiKeySchema),
  (req, res, next) => userController.regenerateEmpresaApiKey(req, res, next)
);

logger.info('[Routes User] Rotas de Utilizador definidas com sucesso.');

export default router;
