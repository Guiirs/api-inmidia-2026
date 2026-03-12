/**
 * Auth DTOs - Schemas de validação com Zod
 */

import { z } from 'zod';
import { ValidationMessages, FieldMessages } from '@shared/validators/validation-messages';

// ============================================
// SCHEMAS DE VALIDAÇÃO
// ============================================

/**
 * Schema para login
 */
const LoginBodySchema = z.object({
  usernameOrEmail: z
    .string()
    .min(1, ValidationMessages.required('Username ou email'))
    .trim(),
  
  password: z
    .string()
    .min(1, ValidationMessages.required('Password')),
});

export const LoginSchema = z.object({
  body: LoginBodySchema,
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

/**
 * Schema para alteração de senha
 */
const ChangePasswordBodySchema = z.object({
  oldPassword: z
    .string()
    .min(6, ValidationMessages.passwordMinLength(6)),
  
  newPassword: z
    .string()
    .min(6, ValidationMessages.passwordMinLength(6))
    .max(100, ValidationMessages.maxLength('Nova senha', 100)),
}).refine(
  (data) => data.oldPassword !== data.newPassword,
  {
    message: 'A nova senha não pode ser igual à senha atual',
    path: ['newPassword'],
  }
);

export const ChangePasswordSchema = z.object({
  body: ChangePasswordBodySchema,
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

/**
 * Schema para solicitar reset de senha
 */
const RequestPasswordResetBodySchema = z.object({
  email: z
    .string()
    .min(1, FieldMessages.email.required)
    .email(FieldMessages.email.invalid)
    .trim()
    .toLowerCase(),
});

export const RequestPasswordResetSchema = z.object({
  body: RequestPasswordResetBodySchema,
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

/**
 * Schema para resetar senha com token
 */
const ResetPasswordBodySchema = z.object({
  newPassword: z
    .string()
    .min(6, ValidationMessages.passwordMinLength(6))
    .max(100, ValidationMessages.maxLength('Nova senha', 100)),
});

const ResetPasswordParamsSchema = z.object({
  token: z
    .string()
    .min(1, ValidationMessages.required('Token')),
});

export const ResetPasswordSchema = z.object({
  body: ResetPasswordBodySchema,
  params: ResetPasswordParamsSchema,
  query: z.object({}).passthrough(),
});

// ============================================
// TIPOS
// ============================================

export type LoginInput = z.infer<typeof LoginBodySchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordBodySchema>;
export type RequestPasswordResetInput = z.infer<typeof RequestPasswordResetBodySchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordBodySchema>;
export type RefreshInput = z.infer<typeof RefreshBodySchema>;

/**
 * Payload do token JWT
 */
export interface JwtPayload {
  id: string;
  empresaId: string;
  role: 'user' | 'admin' | 'superadmin';
  username: string;
  email: string;
}

/**
 * Resposta de login
 */
export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    nome: string;
    telefone?: string;
    role: 'user' | 'admin' | 'superadmin';
    empresaId: string;
    createdAt: Date;
  };
}

export interface RefreshResponse {
  token: string;
  refreshToken: string;
}

/**
 * Resposta de alteração de senha
 */
export interface ChangePasswordResponse {
  message: string;
}

// ============================================
// VALIDATORS
// ============================================

export const validateLogin = (data: unknown): LoginInput => {
  return LoginBodySchema.parse(data);
};

export const validateChangePassword = (data: unknown): ChangePasswordInput => {
  return ChangePasswordBodySchema.parse(data);
};

export const validateRequestPasswordReset = (data: unknown): RequestPasswordResetInput => {
  return RequestPasswordResetBodySchema.parse(data);
};

export const validateResetPassword = (data: unknown): ResetPasswordInput => {
  return ResetPasswordBodySchema.parse(data);
};

const RefreshBodySchema = z.object({
  refreshToken: z.string().min(1, ValidationMessages.required('Refresh token')),
});

export const RefreshSchema = z.object({
  body: RefreshBodySchema,
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

export const validateRefresh = (data: unknown): RefreshInput => {
  return RefreshBodySchema.parse(data);
};
