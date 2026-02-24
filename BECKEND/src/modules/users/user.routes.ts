/**
 * User Routes
 * Rotas HTTP com Dependency Injection
 */

import { Router } from 'express';
import User from './User';
import { UserRepository } from './repositories/user.repository';
import { UserService } from './services/user.service';
import { UserController as NewUserController } from './controllers/user.controller';
import { UserController as OldUserController } from './user.controller'; // Controller com métodos de empresa
import OldUserService from './user.service'; // Service antigo
import authenticateToken from '@middlewares/auth.middleware';

const router = Router();

// Dependency Injection - Novo (refatorado)
const repository = new UserRepository(User);
const service = new UserService(repository);
const controller = new NewUserController(service);

// Controller antigo para rotas de empresa
const oldService = new OldUserService();
const oldController = new OldUserController(oldService);

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// GET /api/v1/user/me - Perfil do Utilizador (usando controller antigo)
router.get('/me', (req, res, next) => oldController.getUserProfile(req, res, next));

// GET /api/v1/user/me/empresa - Perfil da Empresa
router.get('/me/empresa', (req, res, next) => oldController.getEmpresaProfile(req, res, next));

// PUT /api/v1/user/me - Atualizar Perfil do Utilizador (usando controller antigo)
router.put('/me', (req, res, next) => oldController.updateUserProfile(req, res, next));

// POST /api/v1/user/me/empresa/regenerate-api-key - Regenerar API Key
router.post('/me/empresa/regenerate-api-key', (req, res, next) => oldController.regenerateEmpresaApiKey(req, res, next));

// Rotas refatoradas (mantidas para compatibilidade)
// GET /api/v1/users/profile - Busca perfil do usuário
router.get(
  '/profile',
  controller.getProfile
);

// PATCH /api/v1/users/profile - Atualiza perfil do usuário
router.patch(
  '/profile',
  controller.updateProfile
);

export default router;
