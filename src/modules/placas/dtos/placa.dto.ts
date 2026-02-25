/**
 * Placa DTOs & Validation Schemas
 */

import { z } from 'zod';
import { Types } from 'mongoose';
import { ValidationMessages, FieldMessages } from '@shared/validators/validation-messages';

// ============================================
// ZOD SCHEMAS
// ============================================

/**
 * Schema para criação de placa
 */
export const CreatePlacaSchema = z.object({
  numero_placa: z.string()
    .min(1, FieldMessages.numeroPlaca.required)
    .max(50, FieldMessages.numeroPlaca.max)
    .trim(),
  
  regiaoId: z.string()
    .min(1, FieldMessages.regiao.required),
  
  tipo: z.enum(['busdoor', 'backbus', 'frontbus', 'empena', 'painel', 'outdoor', 'totem', 'outro'])
    .optional(),
  
  largura: z.number()
    .positive(ValidationMessages.positive('Largura'))
    .optional()
    .nullable(),
  
  altura: z.number()
    .positive(ValidationMessages.positive('Altura'))
    .optional()
    .nullable(),
  
  localizacao: z.string()
    .max(500, ValidationMessages.maxLength('Localização', 500))
    .optional()
    .nullable(),
  
  nomeDaRua: z.string()
    .max(255, ValidationMessages.maxLength('Nome da rua', 255))
    .optional()
    .nullable(),

  tamanho: z.string()
    .max(50, ValidationMessages.maxLength('Tamanho', 50))
    .optional()
    .nullable(),

  coordenadas: z.union([
    z.string(),
    z.object({
      latitude: z.number()
        .min(-90, FieldMessages.latitude.invalid)
        .max(90, FieldMessages.latitude.invalid),
      longitude: z.number()
        .min(-180, FieldMessages.longitude.invalid)
        .max(180, FieldMessages.longitude.invalid)
    })
  ]).optional().nullable(),
  
  valor_mensal: z.number()
    .nonnegative(ValidationMessages.minValue('Valor mensal', 0))
    .optional()
    .nullable(),
  
  observacoes: z.string()
    .max(1000, FieldMessages.observacoes.max)
    .optional()
    .nullable(),
  
  ativa: z.boolean()
    .default(true),

  disponivel: z.boolean()
    .optional()
});

/**
 * Schema para atualização (todos campos opcionais)
 */
export const UpdatePlacaSchema = CreatePlacaSchema.partial();

/**
 * Schema para query de listagem
 */
export const ListPlacasQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['numero_placa', 'createdAt', 'valor_mensal', 'tipo']).default('numero_placa'),
  order: z.enum(['asc', 'desc']).default('asc'),
  search: z.string().optional(),
  regiaoId: z.string().optional(),
  tipo: z.enum(['busdoor', 'backbus', 'frontbus', 'empena', 'painel', 'outdoor', 'totem', 'outro']).optional(),
  ativa: z.coerce.boolean().optional(),
  disponivel: z.coerce.boolean().optional() // Filtro para placas sem aluguel ativo
});

/**
 * Schema para upload de imagem
 */
export const PlacaImageSchema = z.object({
  mimetype: z.enum(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']),
  size: z.number()
    .max(5 * 1024 * 1024, 'Arquivo muito grande. Tamanho máximo: 5MB'),
  filename: z.string()
});

/**
 * Schema para verificação de disponibilidade
 */
export const CheckDisponibilidadeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  placaId: z.string().optional() // Opcional para verificar múltiplas placas
}).refine((data) => data.endDate > data.startDate, {
  message: 'Data de fim deve ser posterior à data de início',
  path: ['endDate']
});

// ============================================
// TIPOS INFERIDOS
// ============================================

export type CreatePlacaDTO = z.infer<typeof CreatePlacaSchema>;
export type UpdatePlacaDTO = z.infer<typeof UpdatePlacaSchema>;
export type ListPlacasQueryDTO = z.infer<typeof ListPlacasQuerySchema>;
export type PlacaImageDTO = z.infer<typeof PlacaImageSchema>;
export type CheckDisponibilidadeDTO = z.infer<typeof CheckDisponibilidadeSchema>;

// ============================================
// RESPONSE TYPES
// ============================================

/**
 * Placa completa (entidade)
 */
export interface PlacaEntity {
  _id: Types.ObjectId;
  numero_placa: string;
  regiaoId: Types.ObjectId | { _id: Types.ObjectId; nome: string };
  tipo?: string;
  largura?: number;
  altura?: number;
  localizacao?: string;
  coordenadas?: {
    latitude: number;
    longitude: number;
  };
  valor_mensal?: number;
  imagem?: string;
  observacoes?: string;
  ativa: boolean;
  empresaId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Placa resumida para listagem
 */
export interface PlacaListItem {
  id: string;
  _id?: string;
  numero_placa: string;
  regiao_nome: string;
  regiaoId?: string;
  regiao?: { _id: string; id: string; nome: string } | string;
  tipo?: string;
  valor_mensal?: number;
  nomeDaRua?: string;
  coordenadas?: string;
  disponivel?: boolean;
  ativa: boolean;
  imagem?: string;
  // Dados de aluguel (se houver)
  aluguel_ativo?: boolean;
  aluguel_futuro?: boolean;
  statusAluguel?: 'disponivel' | 'alugada' | 'reservada';
  cliente_nome?: string;
  aluguel_data_inicio?: Date;
  aluguel_data_fim?: Date;
}

/**
 * Resultado paginado
 */
export interface PaginatedPlacasResponse {
  data: PlacaListItem[];
  pagination: {
    totalDocs: number;
    totalPages: number;
    currentPage: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Disponibilidade de placa
 */
export interface DisponibilidadeResponse {
  disponivel: boolean;
  placaId: string;
  conflitos?: Array<{
    aluguelId: string;
    startDate: Date;
    endDate: Date;
    cliente: string;
  }>;
}

// ============================================
// HELPERS DE VALIDAÇÃO
// ============================================

/**
 * Valida e sanitiza dados de criação
 */
export function validateCreatePlaca(data: unknown): CreatePlacaDTO {
  return CreatePlacaSchema.parse(data);
}

/**
 * Valida e sanitiza dados de atualização
 */
export function validateUpdatePlaca(data: unknown): UpdatePlacaDTO {
  return UpdatePlacaSchema.parse(data);
}

/**
 * Valida query de listagem
 */
export function validateListQuery(data: unknown): ListPlacasQueryDTO {
  return ListPlacasQuerySchema.parse(data);
}

/**
 * Valida imagem
 */
export function validatePlacaImage(data: unknown): PlacaImageDTO {
  return PlacaImageSchema.parse(data);
}

/**
 * Valida verificação de disponibilidade
 */
export function validateCheckDisponibilidade(data: unknown): CheckDisponibilidadeDTO {
  return CheckDisponibilidadeSchema.parse(data);
}

// ============================================
// TRANSFORMERS
// ============================================

/**
 * Converte PlacaEntity para PlacaListItem
 */
export function toListItem(placa: PlacaEntity & any): PlacaListItem {
  const regiao = placa.regiaoId;
  const regiaoNome = typeof regiao === 'object' && regiao?.nome 
    ? regiao.nome 
    : 'Sem região';

  const regiaoId = typeof regiao === 'object'
    ? (regiao?._id?.toString?.() || regiao?.id)
    : (typeof placa.regiaoId === 'string' ? placa.regiaoId : undefined);
  const disponivel = typeof placa.disponivel === 'boolean'
    ? placa.disponivel
    : (typeof placa.ativa === 'boolean' ? placa.ativa : true);
  const coordenadas = typeof placa.coordenadas === 'string'
    ? placa.coordenadas
    : (placa.coordenadas?.latitude != null && placa.coordenadas?.longitude != null
      ? `${placa.coordenadas.latitude}, ${placa.coordenadas.longitude}`
      : undefined);

  return {
    id: placa._id.toString(),
    _id: placa._id.toString(),
    numero_placa: placa.numero_placa,
    regiao_nome: regiaoNome,
    regiaoId,
    regiao: regiaoId ? { _id: regiaoId, id: regiaoId, nome: regiaoNome } : regiaoNome,
    tipo: placa.tipo,
    valor_mensal: placa.valor_mensal,
    nomeDaRua: placa.nomeDaRua || placa.localizacao,
    coordenadas,
    disponivel,
    ativa: typeof placa.ativa === 'boolean' ? placa.ativa : disponivel,
    imagem: placa.imagem,
    aluguel_ativo: placa.aluguel_ativo,
    aluguel_futuro: placa.aluguel_futuro,
    statusAluguel: placa.statusAluguel,
    cliente_nome: placa.cliente_nome,
    aluguel_data_inicio: placa.aluguel_data_inicio,
    aluguel_data_fim: placa.aluguel_data_fim
  };
}

/**
 * Converte array de PlacaEntity para PlacaListItem[]
 */
export function toListItems(placas: Array<PlacaEntity & any>): PlacaListItem[] {
  return placas.map(toListItem);
}
