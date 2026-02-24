import { Schema } from 'mongoose';
import { IPlaca } from '../../types/models';

export const placaSchema = new Schema<IPlaca>(
  {
    numero_placa: {
      type: String,
      required: [true, 'Número da placa é obrigatório'],
      trim: true,
      index: true,
    },
    coordenadas: {
      type: String,
      trim: true,
    },
    nomeDaRua: {
      type: String,
      trim: true,
    },
    tamanho: {
      type: String,
      trim: true,
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
    regiaoId: {
      type: Schema.Types.ObjectId,
      ref: 'Regiao',
      required: [true, 'Região é obrigatória'],
      index: true,
    },
    empresaId: {
      type: Schema.Types.ObjectId,
      ref: 'Empresa',
      required: [true, 'Empresa é obrigatória'],
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { 
      virtuals: true,
      transform: function(_doc: any, ret: any) {
        // Se regiaoId foi populado, copiar para 'regiao' para compatibilidade frontend
        if (ret.regiaoId && typeof ret.regiaoId === 'object') {
          ret.regiao = ret.regiaoId;
        }
        return ret;
      }
    },
    toObject: { 
      virtuals: true,
      transform: function(_doc: any, ret: any) {
        if (ret.regiaoId && typeof ret.regiaoId === 'object') {
          ret.regiao = ret.regiaoId;
        }
        return ret;
      }
    },
  }
);

// Virtual id
placaSchema.virtual('id').get(function (this: any) {
  return this._id.toHexString();
});

// Virtual para status dinâmico baseado em aluguéis (reservada, alugada, disponível)
// Este campo será populado pela aplicação quando necessário
placaSchema.virtual('statusAluguel');

// Compound index for queries
placaSchema.index({ empresaId: 1, disponivel: 1 });
placaSchema.index({ empresaId: 1, regiaoId: 1 });

// Virtuals para compatibilidade com código legado
placaSchema.virtual('empresa').get(function(this: any) {
  return this.empresaId;
});

placaSchema.virtual('regiao', {
  ref: 'Regiao',
  localField: 'regiaoId',
  foreignField: '_id',
  justOne: true
});
