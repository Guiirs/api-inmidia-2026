import { Schema } from 'mongoose';
import { ICliente } from '../../types/models';

export const clienteSchema = new Schema<ICliente>(
  {
    nome: {
      type: String,
      required: [true, 'O nome do cliente é obrigatório'],
      trim: true,
      maxlength: [200, 'Nome deve ter no máximo 200 caracteres'],
    },
    cpfCnpj: {
      type: String,
      required: [true, 'CPF/CNPJ é obrigatório'],
      unique: true,
      trim: true,
      index: true,
    },
    telefone: {
      type: String,
      trim: true,
    },
    logo_url: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email inválido'],
    },
    endereco: {
      type: String,
      trim: true,
    },
    bairro: {
      type: String,
      trim: true,
    },
    cidade: {
      type: String,
      trim: true,
    },
    responsavel: {
      type: String,
      trim: true,
    },
    segmento: {
      type: String,
      trim: true,
    },
    estado: {
      type: String,
      trim: true,
      maxlength: [2, 'Estado deve ter 2 caracteres (UF)'],
    },
    cep: {
      type: String,
      trim: true,
    },
    ativo: {
      type: Boolean,
      default: true,
      index: true,
    },
    empresaId: {
      type: Schema.Types.ObjectId,
      ref: 'Empresa',
      required: [true, 'O cliente deve pertencer a uma empresa'],
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual id
clienteSchema.virtual('id').get(function (this: any) {
  return this._id.toHexString();
});

// Virtuals legados para compatibilidade com frontend antigo (campos separados)
clienteSchema.virtual('cnpj').get(function (this: any) {
  const value = typeof this.cpfCnpj === 'string' ? this.cpfCnpj.replace(/\D/g, '') : '';
  return value.length === 14 ? value : undefined;
});

clienteSchema.virtual('cpf').get(function (this: any) {
  const value = typeof this.cpfCnpj === 'string' ? this.cpfCnpj.replace(/\D/g, '') : '';
  return value.length === 11 ? value : undefined;
});

// Compound index for unique cpfCnpj per empresa
clienteSchema.index({ empresaId: 1, cpfCnpj: 1 }, { unique: true });

// Virtual para compatibilidade com código legado
clienteSchema.virtual('empresa').get(function(this: any) {
  return this.empresaId;
});
