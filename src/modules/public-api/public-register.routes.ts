/**
 * Public Register Routes (legacy)
 * Active public registration endpoint lives in modules/empresas/empresa-public.routes.ts
 */
import { Router } from 'express';
import logger from '../../shared/container/logger';

const router = Router();

logger.info('[Routes Public] Legacy public-register module loaded with no active routes.');

/**
 * @deprecated Use POST /api/v1/empresas/register from empresa-public.routes.ts
 */
logger.info('[Routes Public] Registration endpoint is deprecated in this module.');

export default router;
