import { z } from 'zod';
import { Types } from 'mongoose';
import { ValidationMessages, FieldMessages } from '@shared/validators/validation-messages';

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

const optionalTrimmedString = (schema: z.ZodString) =>
  z.preprocess(emptyStringToUndefined, schema.optional().nullable());

const nomeSchema = z.string().trim().min(3, FieldMessages.nome.min).max(200, FieldMessages.nome.max);
const emailSchema = optionalTrimmedString(z.string().email(FieldMessages.email.invalid));
const telefoneSchema = optionalTrimmedString(
  z.string().regex(/^\(\d{2}\)\s?\d{4,5}-?\d{4}$/, FieldMessages.telefone.invalid)
);
const cnpjSchema = optionalTrimmedString(
  z.string().regex(/^\d{14}$|^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, FieldMessages.cnpj.invalid)
);
const cpfSchema = optionalTrimmedString(
  z.string().regex(/^\d{11}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/, FieldMessages.cpf.invalid)
);
const cpfCnpjSchema = optionalTrimmedString(z.string().min(11, FieldMessages.cpfCnpj.min));
const responsavelSchema = optionalTrimmedString(
  z.string().max(200, ValidationMessages.maxLength('Nome do responsavel', 200))
);
const segmentoSchema = optionalTrimmedString(
  z.string().max(100, ValidationMessages.maxLength('Segmento', 100))
);
const bairroSchema = optionalTrimmedString(
  z.string().max(150, ValidationMessages.maxLength('Bairro', 150))
);
const enderecoSchema = optionalTrimmedString(z.string().max(500, FieldMessages.endereco.max));
const cidadeSchema = optionalTrimmedString(z.string().max(100, FieldMessages.cidade.max));
const estadoSchema = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().toUpperCase().length(2, FieldMessages.estado.exact).optional().nullable()
);
const cepSchema = optionalTrimmedString(
  z.string().regex(/^\d{5}-?\d{3}$/, FieldMessages.cep.invalid)
);
const logoUrlSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional().nullable()
);

const baseClienteFields = {
  email: emailSchema,
  telefone: telefoneSchema,
  cnpj: cnpjSchema,
  cpf: cpfSchema,
  cpfCnpj: cpfCnpjSchema,
  responsavel: responsavelSchema,
  segmento: segmentoSchema,
  bairro: bairroSchema,
  endereco: enderecoSchema,
  cidade: cidadeSchema,
  estado: estadoSchema,
  cep: cepSchema,
  logo_url: logoUrlSchema,
};

export const CreateClienteSchema = z
  .object({
    nome: nomeSchema,
    ...baseClienteFields,
    ativo: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (!data.cpfCnpj && !data.cnpj && !data.cpf) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cpfCnpj'],
        message: 'Informe CPF ou CNPJ do cliente',
      });
    }
  });

export const UpdateClienteSchema = z.object({
  nome: nomeSchema.optional(),
  ...baseClienteFields,
  ativo: z.boolean().optional(),
});

export const ListClientesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['nome', 'createdAt', 'updatedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  ativo: z.coerce.boolean().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
});

export const ClienteLogoSchema = z.object({
  fieldname: z.string(),
  originalname: z.string(),
  encoding: z.string(),
  mimetype: z.enum(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'], {
    message: ValidationMessages.invalidFileType(['JPEG', 'JPG', 'PNG', 'GIF', 'WEBP']),
  }),
  size: z.number().max(2 * 1024 * 1024, ValidationMessages.fileTooLarge('2MB')),
  buffer: z.instanceof(Buffer).optional(),
  key: z.string(),
  location: z.string(),
  bucket: z.string(),
});

export type CreateClienteDTO = z.infer<typeof CreateClienteSchema>;
export type UpdateClienteDTO = z.infer<typeof UpdateClienteSchema>;
export type ListClientesQueryDTO = z.infer<typeof ListClientesQuerySchema>;
export type ClienteLogoDTO = z.infer<typeof ClienteLogoSchema>;

export interface ClienteEntity {
  _id: Types.ObjectId;
  nome: string;
  email?: string;
  telefone?: string;
  cnpj?: string;
  cpf?: string;
  cpfCnpj?: string;
  responsavel?: string;
  segmento?: string;
  bairro?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  ativo: boolean;
  logo?: string;
  logo_url?: string;
  empresaId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClienteListItem {
  _id: string;
  nome: string;
  email?: string;
  telefone?: string;
  cnpj?: string;
  cpf?: string;
  cpfCnpj?: string;
  cidade?: string;
  ativo: boolean;
  logo_url?: string;
}

export interface PaginatedClientesResponse {
  data: ClienteListItem[];
  pagination: {
    totalDocs: number;
    totalPages: number;
    currentPage: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export function validateCreateCliente(data: unknown): CreateClienteDTO {
  return CreateClienteSchema.parse(data);
}

export function validateUpdateCliente(data: unknown): UpdateClienteDTO {
  return UpdateClienteSchema.parse(data);
}

export function validateListQuery(query: unknown): ListClientesQueryDTO {
  return ListClientesQuerySchema.parse(query);
}

export function validateClienteLogo(file: unknown): ClienteLogoDTO {
  return ClienteLogoSchema.parse(file);
}

function deriveDocumentAliases(entity: Pick<ClienteEntity, 'cpfCnpj'>) {
  const digits = entity.cpfCnpj?.replace(/\D/g, '');
  if (!digits) return { cpf: undefined, cnpj: undefined };

  if (digits.length === 11) {
    return { cpf: digits, cnpj: undefined };
  }

  if (digits.length === 14) {
    return { cpf: undefined, cnpj: digits };
  }

  return { cpf: undefined, cnpj: undefined };
}

export function toListItem(entity: ClienteEntity): ClienteListItem {
  const aliases = deriveDocumentAliases(entity);

  return {
    _id: entity._id.toString(),
    nome: entity.nome,
    email: entity.email,
    telefone: entity.telefone,
    cnpj: entity.cnpj ?? aliases.cnpj,
    cpf: entity.cpf ?? aliases.cpf,
    cpfCnpj: entity.cpfCnpj,
    cidade: entity.cidade,
    ativo: entity.ativo,
    logo_url: entity.logo_url,
  };
}

export function toListItems(entities: ClienteEntity[]): ClienteListItem[] {
  return entities.map(toListItem);
}
