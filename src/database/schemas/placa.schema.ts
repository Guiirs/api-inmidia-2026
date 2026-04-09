import { Schema, Types } from 'mongoose';
import { IPlaca } from '../../types/models';

export const placaSchema = new Schema<IPlaca>(
  {
    numero_placa: {
      type: String,
      required: [true, 'O número da placa é obrigatório'],
      trim: true,
      maxlength: [50, 'Número da placa deve ter no máximo 50 caracteres'],
    },
    cidade: {
      type: String,
      trim: true,
      maxlength: [120, 'Cidade deve ter no máximo 120 caracteres'],
    },
    regiao: {
      type: String,
      trim: true,
      maxlength: [120, 'Região deve ter no máximo 120 caracteres'],
    },
    numero_regiao: {
      type: Number,
      min: [1, 'Número regional deve ser maior que zero'],
    },
    numero_global: {
      type: Number,
      min: [1, 'Número global deve ser maior que zero'],
    },
    codigo: {
      type: String,
      trim: true,
      maxlength: [40, 'Código da placa deve ter no máximo 40 caracteres'],
    },
    nome_placa: {
      type: String,
      trim: true,
      maxlength: [30, 'Nome da placa deve ter no máximo 30 caracteres'],
    },
    coordenadas: {
      type: String,
      trim: true,
    },
    nomeDaRua: {
      type: String,
      trim: true,
    },
    localizacao: {
      type: String,
      trim: true,
    },
    tamanho: {
      type: String,
      trim: true,
      maxlength: [50, 'Tamanho deve ter no máximo 50 caracteres'],
    },
    imagem: {
      type: String,
      trim: true,
    },
    disponivel: {
      type: Boolean,
      default: true,
      index: true,
    },
    ativa: {
      type: Boolean,
      default: true,
    },
    regiaoId: {
      type: Schema.Types.ObjectId,
      ref: 'Regiao',
      required: [true, 'A região é obrigatória'],
      index: true,
    },
    empresaId: {
      type: Schema.Types.ObjectId,
      ref: 'Empresa',
      required: [true, 'A empresa é obrigatória'],
      index: true,
    },
    statusAluguel: {
      type: String,
      trim: true,
      enum: ['disponivel', 'alugada', 'reservada'],
      default: 'disponivel',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

function normalizeCidade(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function siglaFromCidade(cidade: string): string {
  const normalized = cidade
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '');

  if (!normalized) return 'REG';

  return normalized.substring(0, 3).padEnd(3, 'X').toUpperCase();
}

function buildNumeroLabel(numero: unknown): string {
  const n = Number(numero);
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(Math.trunc(n)).padStart(2, '0');
}

function buildCodigo(data: { cidade?: string | undefined; numero_regiao?: number | undefined }): string | undefined {
  if (!data.cidade || !data.numero_regiao || data.numero_regiao <= 0) {
    return undefined;
  }

  const nr = buildNumeroLabel(data.numero_regiao);
  if (!nr) return undefined;

  return `${siglaFromCidade(data.cidade)}-${nr}`;
}

placaSchema.index({ empresaId: 1, cidade: 1, numero_regiao: 1 }, {
  unique: true,
  partialFilterExpression: {
    cidade: { $exists: true },
    numero_regiao: { $type: 'number' },
  },
});

placaSchema.index({ empresaId: 1, numero_global: 1 }, {
  unique: true,
  partialFilterExpression: {
    numero_global: { $type: 'number' },
  },
});

placaSchema.index({ cidade: 1 });
placaSchema.index({ numero_regiao: 1 });
placaSchema.index({ numero_global: 1 });
placaSchema.index({ codigo: 1 });
placaSchema.index({ regiao: 1 });

placaSchema.pre('save', function (next) {
  const documento = this as unknown as IPlaca & {
    numero_regiao?: number;
    numero_global?: number;
    cidade?: string;
    regiao?: string;
    nome_placa?: string;
    codigo?: string;
    disponivel?: boolean;
  };

  documento.cidade = normalizeCidade(documento.cidade);
  // Note: regiao is a virtual field, don't modify it directly

  if (typeof documento.numero_regiao === 'number' && documento.numero_regiao > 0) {
    documento.nome_placa = `Placa ${buildNumeroLabel(documento.numero_regiao)}`;
    const codigo = buildCodigo(documento);
    if (codigo) {
      documento.codigo = codigo;
    }
  } else if (!documento.nome_placa) {
    documento.nome_placa = 'Placa N/A';
  }

  next();
});

placaSchema.pre('findOneAndUpdate', function () {
  const query = this.getUpdate() as any;
  const set = query?.$set || query;

  if (!set || typeof set !== 'object') return;

  const cidade = normalizeCidade(set.cidade);
  const regiao = normalizeCidade(set.regiao);

  if (regiao) {
    set.regiao = regiao;
    if (!cidade) {
      set.cidade = regiao;
    }
  }

  if (cidade) {
    set.cidade = cidade;
    if (!regiao) {
      set.regiao = cidade;
    }
  }

  if (typeof set.numero_regiao === 'number' && set.numero_regiao > 0) {
    set.nome_placa = `Placa ${buildNumeroLabel(set.numero_regiao)}`;
    const cidadeNome = normalizeCidade(set.cidade || cidade || regiao);
    const codigo = buildCodigo({ cidade: cidadeNome, numero_regiao: set.numero_regiao });
    if (codigo) {
      set.codigo = codigo;
    }
  }
});

placaSchema.virtual('id').get(function (this: { _id: Types.ObjectId }) {
  return this._id.toHexString();
});

placaSchema.virtual('empresa').get(function (this: { empresaId: Types.ObjectId }) {
  return this.empresaId;
});
