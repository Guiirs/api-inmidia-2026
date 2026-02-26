/**
 * Error Handler Utilities
 * Funções centralizadas para tratamento de erro com type safety
 */

/**
 * Extrai mensagem de erro de forma segura
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  return 'Unknown error occurred';
}

/**
 * Extrai stack trace de forma segura
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  if (error && typeof error === 'object' && 'stack' in error) {
    return String((error as any).stack);
  }
  return undefined;
}

/**
 * Extrai código de erro (se disponível)
 */
export function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as any).code);
  }
  return undefined;
}

/**
 * Type guard para Error
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Type guard para objeto com mensagem
 */
export function hasMessage(error: unknown): error is { message: string } {
  return typeof error === 'object' && error !== null && 'message' in error;
}

/**
 * Wrapper type-safe para tratamento de erro em catch blocks
 * Uso: catch (error) { handleError(error); }
 */
export function handleError(error: unknown, context?: string): { message: string; stack?: string; code?: string; context?: string } {
  return {
    message: getErrorMessage(error),
    stack: getErrorStack(error),
    code: getErrorCode(error),
    context,
  };
}
