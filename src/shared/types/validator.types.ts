/**
 * Validator Types
 * Tipos centralizados para validadores customizados do express-validator
 */

import type { Request } from 'express';

/**
 * Contexto do validador customizado com tipos
 */
export interface ValidatorContext {
  req: Request & { 
    user?: any; 
    body?: any; 
    params?: any; 
    query?: any 
  };
  
  location?: string;
  path?: string;
}

/**
 * Tipo para função de validação customizada
 */
export type CustomValidatorFn = (value: any, context: ValidatorContext) => boolean | Promise<boolean>;

/**
 * Tipo genérico para handlers de erro
 */
export class ValidationError extends Error {
  constructor(
    public code: string,
    public statusCode: number = 400,
    message?: string
  ) {
    super(message || code);
    this.name = 'ValidationError';
  }
}

/**
 * Tipo para erros de API
 */
export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, any>;
}

/**
 * Type guard para ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof Error && 'statusCode' in error;
}

/**
 * Type guard para ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}
