/**
 * Contrato DTOs & Validation Schemas
 */

import { z } from 'zod';
import { Types } from 'mongoose';
import { ValidationMessages } from '@shared/validators/validation-messages';

// ============================================
// ZOD SCHEMAS
// ============================================

export const CreateContratoSchema = z.object({
  piId: z.string().min(1, ValidationMessages.required('PI')),
});

export const UpdateContratoSchema = z.object({
  status: z.enum(['rascunho', 'ativo', 'concluido', 'cancelado']).optional(),
  numero: z.string().min(1).max(100).optional(),
});

export const ListContratosQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['createdAt', 'numero', 'status']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(['rascunho', 'ativo', 'concluido', 'cancelado']).optional(),
  clienteId: z.string().optional(),
});

// ============================================
// TIPOS INFERIDOS
// ============================================

export type CreateContratoDTO = z.infer<typeof CreateContratoSchema>;
export type UpdateContratoDTO = z.infer<typeof UpdateContratoSchema>;
export type ListContratosQueryDTO = z.infer<typeof ListContratosQuerySchema>;

// ============================================
// RESPONSE TYPES
// ============================================

export interface ContratoEntity {
  _id: Types.ObjectId;
  empresaId: Types.ObjectId | { _id: Types.ObjectId; nome: string };
  clienteId: Types.ObjectId | { _id: Types.ObjectId; nome: string };
  piId: Types.ObjectId | Record<string, unknown>;
  numero: string;
  status: 'rascunho' | 'ativo' | 'concluido' | 'cancelado';
  createdAt: Date;
  updatedAt: Date;
}

export interface ContratoListItem {
  id: string;
  numero: string;
  cliente_nome: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedContratosResponse {
  data: ContratoListItem[];
  pagination: {
    totalDocs: number;
    totalPages: number;
    currentPage: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// ============================================
// HELPERS DE VALIDACAO
// ============================================

export function validateCreateContrato(data: unknown): CreateContratoDTO {
  return CreateContratoSchema.parse(data);
}

export function validateUpdateContrato(data: unknown): UpdateContratoDTO {
  return UpdateContratoSchema.parse(data);
}

export function validateListQuery(data: unknown): ListContratosQueryDTO {
  return ListContratosQuerySchema.parse(data);
}

// ============================================
// TRANSFORMERS
// ============================================

type ContratoListSource = ContratoEntity & {
  clienteId: Types.ObjectId | { _id?: Types.ObjectId; nome?: string };
};

function hasNome(value: unknown): value is { nome?: string } {
  return typeof value === 'object' && value !== null && 'nome' in value;
}

export function toListItem(contrato: ContratoListSource): ContratoListItem {
  const cliente = contrato.clienteId;
  const clienteNome = hasNome(cliente) && cliente.nome
    ? cliente.nome
    : 'Cliente nao informado';

  return {
    id: contrato._id.toString(),
    numero: contrato.numero,
    cliente_nome: clienteNome,
    status: contrato.status,
    createdAt: contrato.createdAt,
    updatedAt: contrato.updatedAt,
  };
}

export function toListItems(contratos: ContratoListSource[]): ContratoListItem[] {
  return contratos.map(toListItem);
}
