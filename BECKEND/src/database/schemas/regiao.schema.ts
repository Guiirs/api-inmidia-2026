import { Schema } from 'mongoose';
import { IRegiao } from '../../types/models';

export const regiaoSchema = new Schema<IRegiao>(
  {
    nome: {
      type: String,
      required: [true, 'O nome da região é obrigatório'],
      trim: true,
      maxlength: [100, 'Nome deve ter no máximo 100 caracteres'],
    },
    codigo: {
      type: String,
      required: [true, 'O código da região é obrigatório'],
      trim: true,
      uppercase: true,
    },
    descricao: {
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
      required: [true, 'Região deve pertencer a uma empresa'],
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
regiaoSchema.virtual('id').get(function (this: any) {
  return this._id.toHexString();
});

// Compound unique index: nome must be unique per empresa
regiaoSchema.index({ empresaId: 1, nome: 1 }, { unique: true });

// Virtual para compatibilidade com código legado
regiaoSchema.virtual('empresa').get(function(this: any) {
  return this.empresaId;
});
