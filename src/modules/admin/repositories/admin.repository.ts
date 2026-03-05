import { Model, PipelineStage, Types } from 'mongoose';
import { Result } from '@shared/core/Result';
import { DomainError, ValidationError } from '@shared/core/DomainError';
import { DashboardStats } from '../dtos/admin.dto';

/**
 * Repository para operações administrativas
 */
export class AdminRepository {
  constructor(
    private readonly clienteModel: Model<any>,
    private readonly placaModel: Model<any>,
    private readonly aluguelModel: Model<any>,
    private readonly contratoModel: Model<any>,
    private readonly userModel: Model<any>,
    private readonly empresaModel: Model<any>,
    private readonly regiaoModel: Model<any>
  ) {}

  /**
   * Buscar estatísticas do dashboard
   */
  async getDashboardStats(startDate?: Date, endDate?: Date, empresaId?: string): Promise<Result<DashboardStats, DomainError>> {
    try {
      const filter: Record<string, unknown> = {};
      const dateFilter: Record<string, Date> = {};
      const empresaObjectId = empresaId ? new Types.ObjectId(empresaId) : null;

      if (empresaObjectId) {
        filter.empresaId = empresaObjectId;
      }

      if (startDate || endDate) {
        if (startDate) dateFilter.$gte = startDate;
        if (endDate) dateFilter.$lte = endDate;
        filter.createdAt = dateFilter;
      }

      // Overview
      const [totalClientes, totalPlacas, totalAlugueis, totalContratos, totalUsers] = await Promise.all([
        this.clienteModel.countDocuments(filter),
        this.placaModel.countDocuments(filter),
        this.aluguelModel.countDocuments(filter),
        this.contratoModel.countDocuments(filter),
        this.userModel.countDocuments()
      ]);

      // Aluguéis por status
      const alugueisAggregate = await this.aluguelModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            valorTotal: { $sum: '$valor_mensal' }
          }
        }
      ]);

      const alugueisStats = {
        ativos: alugueisAggregate
          .filter(a => a._id === 'ATIVO' || a._id === 'ativo')
          .reduce((sum, item) => sum + (item.count || 0), 0),
        inativos: alugueisAggregate
          .filter(a => a._id === 'INATIVO' || a._id === 'inativo')
          .reduce((sum, item) => sum + (item.count || 0), 0),
        aguardandoAprovacao: alugueisAggregate.find(a => a._id === 'AGUARDANDO_APROVACAO')?.count || 0,
        valorTotal: alugueisAggregate.reduce((sum, a) => sum + (a.valorTotal || 0), 0)
      };

      // Financeiro
      const receitaMensal = alugueisStats.valorTotal;
      const receitaAnual = receitaMensal * 12;
      const ticketMedio = totalAlugueis > 0 ? receitaMensal / totalAlugueis : 0;

      // Estatísticas por região
      const regioesPipeline: PipelineStage[] = [];
      if (empresaObjectId) {
        regioesPipeline.push({ $match: { empresaId: empresaObjectId } } as PipelineStage);
      }
      regioesPipeline.push(
        {
          $lookup: {
            from: 'placas',
            localField: '_id',
            foreignField: 'regiaoId',
            as: 'placas'
          }
        } as PipelineStage,
        {
          $lookup: {
            from: 'alugueis',
            let: { placaIds: '$placas._id' },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ['$placaId', '$$placaIds'] },
                  ...(empresaObjectId ? { empresaId: empresaObjectId } : {}),
                  ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {})
                }
              }
            ],
            as: 'alugueis'
          }
        } as PipelineStage,
        {
          $project: {
            nome: 1,
            totalPlacas: { $size: '$placas' },
            totalAlugueis: { $size: '$alugueis' }
          }
        } as PipelineStage
      );

      const regioes = await this.regiaoModel.aggregate(regioesPipeline);

      // Estatísticas por empresa
      const empresasPipeline: PipelineStage[] = [];
      if (empresaObjectId) {
        empresasPipeline.push({ $match: { _id: empresaObjectId } } as PipelineStage);
      }
      empresasPipeline.push(
        {
          $lookup: {
            from: 'clientes',
            localField: '_id',
            foreignField: 'empresaId',
            as: 'clientes'
          }
        } as PipelineStage,
        {
          $lookup: {
            from: 'alugueis',
            localField: '_id',
            foreignField: 'empresaId',
            as: 'alugueis'
          }
        } as PipelineStage,
        {
          $project: {
            nome: 1,
            totalClientes: { $size: '$clientes' },
            totalAlugueis: { $size: '$alugueis' },
            receita: {
              $sum: '$alugueis.valor_mensal'
            }
          }
        } as PipelineStage
      );

      const empresas = await this.empresaModel.aggregate(empresasPipeline);

      const stats: DashboardStats = {
        overview: {
          totalClientes,
          totalPlacas,
          totalAlugueis,
          totalContratos,
          totalUsers
        },
        alugueis: alugueisStats,
        financeiro: {
          receitaMensal,
          receitaAnual,
          ticketMedio
        },
        regioes: regioes.map(r => ({
          nome: r.nome,
          totalPlacas: r.totalPlacas,
          totalAlugueis: r.totalAlugueis
        })),
        empresas: empresas.map(e => ({
          nome: e.nome,
          totalClientes: e.totalClientes,
          totalAlugueis: e.totalAlugueis,
          receita: e.receita || 0
        }))
      };

      return Result.ok(stats);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{
          field: 'stats',
          message: error.message
        }])
      );
    }
  }

  /**
   * Executar operação em lote
   */
  async bulkOperation(
    entityType: string,
    operation: string,
    ids: string[],
    data?: Record<string, any>
  ): Promise<Result<{ processed: number; succeeded: number; failed: number; errors: any[] }, DomainError>> {
    try {
      const model = this._getModel(entityType);
      
      if (!model) {
        return Result.fail(
          new ValidationError([{
            field: 'entityType',
            message: 'Tipo de entidade inválido'
          }])
        );
      }

      const objectIds = ids.map(id => new Types.ObjectId(id));
      let result;
      const errors: any[] = [];

      switch (operation) {
        case 'DELETE':
          result = await model.deleteMany({ _id: { $in: objectIds } });
          break;
        
        case 'UPDATE':
          if (!data) {
            return Result.fail(
              new ValidationError([{
                field: 'data',
                message: 'Dados são obrigatórios para operação UPDATE'
              }])
            );
          }
          result = await model.updateMany(
            { _id: { $in: objectIds } },
            { $set: data }
          );
          break;
        
        case 'ACTIVATE':
          result = await model.updateMany(
            { _id: { $in: objectIds } },
            { $set: { status: 'ATIVO' } }
          );
          break;
        
        case 'DEACTIVATE':
          result = await model.updateMany(
            { _id: { $in: objectIds } },
            { $set: { status: 'INATIVO' } }
          );
          break;
        
        default:
          return Result.fail(
            new ValidationError([{
              field: 'operation',
              message: 'Operação inválida'
            }])
          );
      }

      const succeeded = 'modifiedCount' in result ? result.modifiedCount : ('deletedCount' in result ? result.deletedCount : 0);

      return Result.ok({
        processed: ids.length,
        succeeded,
        failed: ids.length - succeeded,
        errors
      });
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{
          field: 'bulkOperation',
          message: error.message
        }])
      );
    }
  }

  /**
   * Obter modelo baseado no tipo de entidade
   */
  private _getModel(entityType: string): Model<any> | null {
    const models: Record<string, Model<any>> = {
      'CLIENTE': this.clienteModel,
      'PLACA': this.placaModel,
      'ALUGUEL': this.aluguelModel,
      'CONTRATO': this.contratoModel,
      'USER': this.userModel
    };

    return models[entityType] || null;
  }
}
