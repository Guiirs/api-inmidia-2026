import { body, validationResult, ValidationChain, ValidationError } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import AppError from '@shared/container/AppError';

// Regras de validação para a rota de registro
export const registerValidationRules: ValidationChain[] = [
    body('email')
        .isEmail()
        .withMessage('O email fornecido é inválido.')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 6 })
        .withMessage('A senha precisa ter no mínimo 6 caracteres.'),
    body('username')
        .trim()
        .notEmpty()
        .withMessage('O nome de utilizador é obrigatório.'),
    body('nome')
        .trim()
        .notEmpty()
        .withMessage('O nome é obrigatório.')
];

// Regras de validação para a rota de login
export const loginValidationRules: ValidationChain[] = [
    body('email')
        .isEmail()
        .withMessage('O email fornecido é inválido.')
        .normalizeEmail(),
    body('password')
        .notEmpty()
        .withMessage('A senha é obrigatória.')
];

// Middleware que verifica e formata os erros de validação
export const handleValidationErrors = (
    req: Request,
    _res: Response,
    next: NextFunction
): void | Response => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        return next();
    }

    // Estrutura os erros
    const extractedErrors: Record<string, string> = {};
    errors.array({ onlyFirstError: true }).forEach((err: ValidationError) => {
        const field = 'path' in err ? String(err.path) : '_error';
        if (!extractedErrors[field]) {
            extractedErrors[field] = String(err.msg);
        }
    });

    // Cria e passa o AppError estruturado
    const error = new AppError('Erro de validação nos dados enviados.', 400);
    (error as AppError & { validationErrors?: Record<string, string> }).validationErrors = extractedErrors;

    return next(error);
};
