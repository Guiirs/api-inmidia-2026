/**
 * Audit Routes
 * Rotas do módulo de auditoria
 */

import { Router } from 'express';
import AuditLog from './AuditLog';
import { AuditRepository } from './repositories/audit.repository';
import { AuditService } from './services/audit.service';
import { AuditController } from './controllers/audit.controller';
import authMiddleware from '@shared/infra/http/middlewares/auth.middleware';

const router = Router();

// Dependency Injection
const repository = new AuditRepository(AuditLog);
const service = new AuditService(repository);
const controller = new AuditController(service);

/**
 * Todas as rotas de audit requerem autenticação
 */
router.use(authMiddleware);

// GET /api/audit - Lista logs com filtros
router.get('/', controller.listLogs);

// GET /api/audit/:id - Busca log específico
router.get('/:id', controller.getLogById);

// GET /api/audit/resource/:resourceId - Logs de um resource
router.get('/resource/:resourceId', controller.getLogsByResource);

export default router;
