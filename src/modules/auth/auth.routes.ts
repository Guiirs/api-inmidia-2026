/**
 * Auth Routes - Rotas HTTP com Dependency Injection
 */

import { Router } from 'express';
import User from '@modules/users/User';
import { AuthRepository } from './repositories/auth.repository';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import authenticateToken from '@middlewares/auth.middleware';
import { authRateLimiter } from '@shared/infra/http/middlewares/rate-limit.middleware';
import { validate } from '@shared/infra/http/middlewares/validate.middleware';
import { RefreshSchema, LoginSchema, RequestPasswordResetSchema, ResetPasswordSchema, ChangePasswordSchema } from './dtos/auth.dto';

const router = Router();

// Dependency Injection
const repository = new AuthRepository(User);
const service = new AuthService(repository);
const controller = new AuthController(service);

// POST /api/v1/auth/login - Login (público)
router.post(
  '/login',
  authRateLimiter,
  validate(LoginSchema),
  controller.login
);

// POST /api/v1/auth/change-password - Alterar senha (autenticado)
router.post(
  '/change-password',
  authenticateToken,
  validate(ChangePasswordSchema),
  controller.changePassword
);

// POST /api/v1/auth/refresh - Renova tokens (público)
router.post(
  '/refresh',
  authRateLimiter,
  validate(RefreshSchema),
  controller.refresh
);

// POST /api/v1/auth/forgot-password - Solicitar reset de senha (público)
router.post(
  '/forgot-password',
  authRateLimiter,
  validate(RequestPasswordResetSchema),
  controller.forgotPassword
);

// POST /api/v1/auth/reset-password/:token - Resetar senha com token (público)
router.post(
  '/reset-password/:token',
  authRateLimiter,
  validate(ResetPasswordSchema),
  controller.resetPassword
);

// GET /api/v1/auth/verify-token/:token - Verificar validade do token (público)
router.get(
  '/verify-token/:token',
  authRateLimiter,
  controller.verifyResetToken
);

export default router;
