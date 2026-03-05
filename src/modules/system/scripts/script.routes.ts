/**
 * Script Routes
 * Rotas de execucao de scripts
 */
import { Router } from 'express';
import { z } from 'zod';
import { run } from './script.controller';
import adminAuth from '../../../shared/infra/http/middlewares/admin-auth.middleware';
import { adminRateLimiter } from '../../../shared/infra/http/middlewares/rate-limit.middleware';
import { validate } from '../../../shared/infra/http/middlewares/validate.middleware';

const router = Router();

const runScriptSchema = z.object({
  body: z.object({
    script: z.string().min(1),
    args: z.array(z.string()).optional(),
    background: z.boolean().optional(),
  }),
});

router.post('/run', adminAuth, adminRateLimiter, validate(runScriptSchema), run);

export default router;
