/**
 * User Routes
 * Rotas HTTP com Dependency Injection
 */

import { Router } from 'express';
import User from './User';
import { UserRepository } from './repositories/user.repository';
import { UserService } from './services/user.service';
import { UserController } from './controllers/user.controller';
import authenticateToken from '@middlewares/auth.middleware';

const router = Router();

// Dependency Injection - Novo (refatorado)
const repository = new UserRepository(User);
const service = new UserService(repository);
const controller = new UserController(service);

// Todas as rotas requerem autenticacao
router.use(authenticateToken);

// GET /api/v1/user/me - Perfil do Utilizador
router.get('/me', controller.getProfile);

// GET /api/v1/user/me/empresa - Perfil da Empresa
router.get('/me/empresa', controller.getEmpresaProfile);

// PUT /api/v1/user/me - Atualizar Perfil do Utilizador
router.put('/me', controller.updateProfile);

// POST /api/v1/user/me/empresa/regenerate-api-key - Regenerar API Key
router.post('/me/empresa/regenerate-api-key', controller.regenerateEmpresaApiKey);

// Rotas refatoradas (mantidas para compatibilidade)
// GET /api/v1/users/profile - Busca perfil do usuario
router.get('/profile', controller.getProfile);

// PATCH /api/v1/users/profile - Atualiza perfil do usuario
router.patch('/profile', controller.updateProfile);

export default router;
