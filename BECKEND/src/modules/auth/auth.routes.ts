/**
 * Auth Routes - Rotas HTTP com Dependency Injection
 */

import { Router } from 'express';
import User from '@modules/users/User';
import { AuthRepository } from './repositories/auth.repository';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import authenticateToken from '@middlewares/auth.middleware';

const router = Router();

// Dependency Injection
const repository = new AuthRepository(User);
const service = new AuthService(repository);
const controller = new AuthController(service);

// POST /api/v1/auth/login - Login (público)
router.post(
  '/login',
  controller.login
);

// POST /api/v1/auth/change-password - Alterar senha (autenticado)
router.post(
  '/change-password',
  authenticateToken,
  controller.changePassword
);

// POST /api/v1/auth/forgot-password - Solicitar reset de senha (público)
router.post(
  '/forgot-password',
  controller.forgotPassword
);

// POST /api/v1/auth/reset-password/:token - Resetar senha com token (público)
router.post(
  '/reset-password/:token',
  controller.resetPassword
);

// GET /api/v1/auth/verify-token/:token - Verificar validade do token (público)
router.get(
  '/verify-token/:token',
  controller.verifyResetToken
);

export default router;
