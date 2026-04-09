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
 * Schema para criaÃ§Ã£o de placa
 */
export const CreatePlacaSchema = z.object({
  numero_placa: z.string()
    .min(1, FieldMessages.numeroPlaca.required)
    .max(50, FieldMessages.numeroPlaca.max)
    .trim(),
  
  regiaoId: z.string()
    .min(1, FieldMessages.regiao.required),
  
  cidade: z.string()
    .max(120, ValidationMessages.maxLength('Cidade', 120))
    .optional(),
  
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
    .max(500, ValidationMessages.maxLength('LocalizaÃ§Ã£o', 500))
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
 * Schema para atualizaÃ§Ã£o (todos campos opcionais)
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
    .max(5 * 1024 * 1024, 'Arquivo muito grande. Tamanho mÃ¡ximo: 5MB'),
  filename: z.string()
});

/**
 * Schema para verificaÃ§Ã£o de disponibilidade
 */
export const CheckDisponibilidadeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  placaId: z.string().optional() // Opcional para verificar mÃºltiplas placas
}).refine((data) => data.endDate > data.startDate, {
  message: 'Data de fim deve ser posterior Ã  data de inÃ­cio',
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
  numero_regiao?: number;
  numero_global?: number;
  codigo?: string;
  nome_placa?: string;
  cidade?: string;
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

type PlacaListSource = PlacaEntity & {
  nomeDaRua?: string;
  coordenadas?: string | { latitude?: number; longitude?: number };
  disponivel?: boolean;
  aluguel_ativo?: boolean;
  aluguel_futuro?: boolean;
  statusAluguel?: 'disponivel' | 'alugada' | 'reservada';
  cliente_nome?: string;
  aluguel_data_inicio?: Date;
  aluguel_data_fim?: Date;
  regiaoId: Types.ObjectId | { _id?: Types.ObjectId; id?: string; nome?: string } | string;
};

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
  imagem_url?: string | null;
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
// HELPERS DE VALIDAÃ‡ÃƒO
// ============================================

/**
 * Valida e sanitiza dados de criaÃ§Ã£o
 */
export function validateCreatePlaca(data: unknown): CreatePlacaDTO {
  return CreatePlacaSchema.parse(data);
}

/**
 * Valida e sanitiza dados de atualizaÃ§Ã£o
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
 * Valida verificaÃ§Ã£o de disponibilidade
 */
export function validateCheckDisponibilidade(data: unknown): CheckDisponibilidadeDTO {
  return CheckDisponibilidadeSchema.parse(data);
}

function hasNome(value: unknown): value is { nome?: string } {
  return typeof value === 'object' && value !== null && 'nome' in value;
}

const imagemBaseUrl =
  `${(process.env.R2_PUBLIC_URL || 'https://pub-a7928cc212cd43008627cd87e0ecdf91.r2.dev').replace(/\/$/, '')}/inmidia-uploads-sistema/inmidia-uploads-sistema/`;

function toImagemUrl(imagem?: string | null): string | null {
  if (typeof imagem !== 'string') {
    return null;
  }

  const nomeArquivo = imagem.trim().replace(/^\/+/, '');

  if (!nomeArquivo) {
    return null;
  }

  if (/^https?:\/\//i.test(nomeArquivo)) {
    return nomeArquivo;
  }

  return `${imagemBaseUrl}${nomeArquivo}`;
}

// ============================================
// TRANSFORMERS
// ============================================

/**
 * Converte PlacaEntity para PlacaListItem
 */
export function toListItem(placa: PlacaListSource): PlacaListItem {
  const regiao = placa.regiaoId;
  const regiaoNome = hasNome(regiao) && regiao.nome
    ? regiao.nome
    : 'Sem regiao';

  const regiaoId: string | undefined = (() => {
    if (typeof regiao === 'object' && regiao !== null) {
      if ('_id' in regiao && (regiao as { _id?: unknown })._id != null) {
        return String((regiao as { _id: unknown })._id);
      }
      if ('id' in regiao && (regiao as { id?: unknown }).id != null) {
        return String((regiao as { id: unknown }).id);
      }
      return undefined;
    }
    if (typeof placa.regiaoId === 'string') {
      return placa.regiaoId;
    }
    return undefined;
  })();
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
    imagem_url: toImagemUrl(placa.imagem),
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
export function toListItems(placas: PlacaListSource[]): PlacaListItem[] {
  return placas.map(toListItem);
}

