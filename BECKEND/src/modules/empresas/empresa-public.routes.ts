/**
 * Empresa Public Routes
 * Rotas públicas de empresas (sem autenticação)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import Empresa from './Empresa';
import { EmpresaRepository } from './repositories/empresa.repository';
import { EmpresaService } from './services/empresa.service';
import { EmpresaController } from './empresa.controller';
import logger from '@shared/container/logger';

const router = Router();

// Dependency Injection
const repository = new EmpresaRepository(Empresa);
const service = new EmpresaService(repository);
const controller = new EmpresaController(service);

// Middleware de validação de erros
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array({ onlyFirstError: true })[0]?.msg || 'Validation error';
    logger.warn(`[EmpresaPublicRoutes] Validação falhou: ${firstError}`);
    res.status(400).json({
      success: false,
      error: firstError,
      code: 'VALIDATION_ERROR'
    });
    return;
  }
  next();
};

/**
 * POST /api/v1/empresas/register
 * Registra uma nova empresa com usuário admin
 */
router.post(
  '/register',
  [
    body('nome_empresa')
      .trim()
      .notEmpty().withMessage('Nome da empresa é obrigatório')
      .isLength({ min: 1, max: 200 }).withMessage('Nome deve ter entre 1 e 200 caracteres'),
    
    body('cnpj')
      .trim()
      .notEmpty().withMessage('CNPJ é obrigatório')
      .matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{14}$/).withMessage('CNPJ inválido'),
    
    body('email')
      .trim()
      .notEmpty().withMessage('Email é obrigatório')
      .isEmail().withMessage('Email inválido'),
    
    body('password')
      .notEmpty().withMessage('Senha é obrigatória')
      .isLength({ min: 8 }).withMessage('Senha deve ter no mínimo 8 caracteres'),
    
    body('username')
      .trim()
      .notEmpty().withMessage('Username é obrigatório')
      .isLength({ min: 3, max: 50 }).withMessage('Username deve ter entre 3 e 50 caracteres'),
    
    body('nome')
      .trim()
      .notEmpty().withMessage('Nome é obrigatório')
      .isLength({ min: 1, max: 100 }).withMessage('Nome deve ter entre 1 e 100 caracteres'),
    
    body('sobrenome')
      .trim()
      .notEmpty().withMessage('Sobrenome é obrigatório')
      .isLength({ min: 1, max: 100 }).withMessage('Sobrenome deve ter entre 1 e 100 caracteres'),
  ],
  handleValidationErrors,
  controller.register
);

logger.info('[Routes EmpresaPublic] Rota POST /register definida com validação.');

export default router;
