/**
 * PI Service
 * Lógica de propostas internas
 */
// src/modules/propostas-internas/pi.service.ts
import PropostaInterna from './PropostaInterna';
import Cliente from '../clientes/Cliente';
import User from '../users/User';
import Empresa from '../empresas/Empresa';
import Aluguel from '../alugueis/Aluguel';
import AppError from '../../shared/container/AppError';
import logger from '../../shared/container/logger';
import pdfService from '../../shared/container/pdf.service';
import PeriodService from '../../shared/container/period.service';
import XlsxPopulate from 'xlsx-populate';
import path from 'path';
import fs from 'fs/promises';
import { convertXlsxBufferToPdf } from '../../shared/utils/xlsx-to-pdf.converter';
import type { Response } from 'express';

type ObjectIdLike = { _id?: unknown; toString(): string } | string;

interface PIServicePeriod {
    periodType: string;
    startDate?: Date | string;
    endDate?: Date | string;
    biWeekIds?: string[];
    biWeeks?: Array<{ _id: unknown }>;
}

interface PIServiceData extends Record<string, any> {
    cliente: string;
    placas?: ObjectIdLike[];
    periodType?: string;
    startDate?: Date | string;
    endDate?: Date | string;
    dataInicio?: Date | string;
    dataFim?: Date | string;
    data_inicio?: Date | string;
    data_fim?: Date | string;
    biWeekIds?: string[];
    bi_week_ids?: string[];
    biWeeks?: Array<{ _id: unknown }>;
    bi_weeks?: Array<{ _id: unknown }>;
}

interface PIListQueryParams extends Record<string, any> {
    page?: string | number;
    limit?: string | number;
    sortBy?: string;
    order?: string;
    status?: string;
    clienteId?: string;
}

interface PIUpdateData extends Record<string, any> {
    cliente?: string;
    placas?: ObjectIdLike[];
}

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return String(error);
};

const getErrorStack = (error: unknown): string | undefined => (
    error instanceof Error ? error.stack : undefined
);

class PIService {

    /**
     * Gera um código único para sincronização PI ↔ Aluguéis
     */
    _generatePICode(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `PI-${timestamp}-${random}`.toUpperCase();
    }

    /**
     * Cria aluguéis automaticamente para as placas da PI
     * [PERÍODO UNIFICADO] Recebe objeto period completo
     */
    async _criarAlugueisParaPI(piId: ObjectIdLike, piCode: string, clienteId: ObjectIdLike, placaIds: ObjectIdLike[] | undefined, period: PIServicePeriod, empresaId: string): Promise<any[] | void> {
        if (!placaIds || placaIds.length === 0) {
            logger.debug(`[PIService] Nenhuma placa para criar aluguéis`);
            return;
        }

        // Garante que clienteId é um ObjectId, não um objeto populado
        const clienteIdFinal = (typeof clienteId === 'object' && clienteId !== null && '_id' in clienteId)
            ? (clienteId as { _id?: unknown })._id || clienteId
            : clienteId;

        logger.info(`[PIService] Criando ${placaIds.length} aluguéis para PI ${piId} (Code: ${piCode})`);
        logger.debug(`[PIService] clienteId recebido: ${clienteId}, clienteIdFinal: ${clienteIdFinal}`);

        const alugueis = placaIds.map((placaId: ObjectIdLike, index: number) => {
            const aluguel = {
                placaId: placaId,
                clienteId: clienteIdFinal,
                empresaId: empresaId,
                // [PERÍODO UNIFICADO] Novos campos
                periodType: period.periodType,
                startDate: period.startDate,
                endDate: period.endDate,
                biWeekIds: period.biWeekIds || [],
                biWeeks: period.biWeeks ? period.biWeeks.map((bw: { _id: unknown }) => bw._id) : [],
                // [LEGADO] Mantido para compatibilidade
                data_inicio: period.startDate,
                data_fim: period.endDate,
                bi_week_ids: period.biWeekIds || [],
                bi_weeks: period.biWeeks ? period.biWeeks.map((bw: { _id: unknown }) => bw._id) : [],
                // PI sync
                pi_code: piCode,
                proposta_interna: piId,
                tipo: 'pi'
            };
            logger.debug(`[PIService] Aluguel ${index + 1}/${placaIds.length}: ${JSON.stringify(aluguel)}`);
            return aluguel;
        });

        try {
            const alugueisCreated = await Aluguel.insertMany(alugueis);
            logger.info(`[PIService] ${alugueisCreated.length} aluguéis criados com sucesso para PI ${piId}`);
            
            // NOTA: Não modificamos o campo 'disponivel' das placas aqui
            // A disponibilidade é gerenciada pela verificação de conflitos de datas
            // O campo 'disponivel: false' é reservado para manutenção manual
            
            return alugueisCreated;
        } catch (error: unknown) {
            logger.error(`[PIService] Erro ao criar aluguéis para PI ${piId}: ${getErrorMessage(error)}`);
            throw new AppError(`Erro ao criar aluguéis: ${getErrorMessage(error)}`, 500);
        }
    }

    /**
     * Valida se o cliente pertence à empresa
     */
    async _validateCliente(clienteId: string, empresaId: string): Promise<any> {
        const cliente = await Cliente.findOne({ _id: clienteId, empresaId: empresaId }).lean();
        if (!cliente) {
            throw new AppError('Cliente não encontrado ou não pertence à sua empresa.', 404);
        }
        return cliente;
    }

    /**
     * Cria uma nova PI
     * [PERÍODO UNIFICADO] Processa período usando PeriodService
     */
    async create(piData: PIServiceData, empresaId: string): Promise<any> {
        logger.info(`[PIService] Criando PI para empresa ${empresaId}`);
        logger.debug(`[PIService] piData recebido: ${JSON.stringify(piData, null, 2)}`);
        logger.debug(`[PIService] Placas recebidas: ${piData.placas?.length || 0} placas - ${JSON.stringify(piData.placas)}`);
        
        // Valida o cliente antes de criar.
        // Note que piData.cliente é o ID.
        await this._validateCliente(piData.cliente, empresaId);

        // [PERÍODO UNIFICADO] Processar período usando PeriodService
        let period: PIServicePeriod;
        try {
            logger.debug('[PIService] Processando período com PeriodService...');
            
            // Extrair apenas os campos de período do piData
            const periodInput = {
                periodType: piData.periodType,
                tipoPeriodo: piData.tipoPeriodo,
                startDate: piData.startDate,
                endDate: piData.endDate,
                dataInicio: piData.dataInicio,
                dataFim: piData.dataFim,
                data_inicio: piData.data_inicio,
                data_fim: piData.data_fim,
                biWeekIds: piData.biWeekIds,
                bi_week_ids: piData.bi_week_ids,
                biWeeks: piData.biWeeks,
                bi_weeks: piData.bi_weeks
            };
            
            logger.debug(`[PIService] periodInput extraído:`, periodInput);
            period = await PeriodService.processPeriodInput(periodInput);
            
            logger.info(`[PIService] Período processado: Tipo=${period.periodType}`);
            logger.info(`[PIService] Datas: ${PeriodService.formatDate(period.startDate)} - ${PeriodService.formatDate(period.endDate)}`);
            if (period.biWeekIds && period.biWeekIds.length > 0) {
                logger.info(`[PIService] Bi-semanas: ${period.biWeekIds.join(', ')}`);
            }
        } catch (periodError: unknown) {
            logger.error(`[PIService] Erro ao processar período: ${getErrorMessage(periodError)}`);
            throw periodError; // PeriodService já lança AppError
        }

        // Gera código único de sincronização
        const piCode = this._generatePICode();
        logger.info(`[PIService] Código de sincronização gerado: ${piCode}`);

        const novaPI = new PropostaInterna({
            ...piData,
            empresaId: empresaId,
            pi_code: piCode,
            status: 'em_andamento', // Garante o status inicial
            // [PERÍODO UNIFICADO] Novos campos
            periodType: period.periodType,
            startDate: period.startDate,
            endDate: period.endDate,
            biWeekIds: period.biWeekIds,
            biWeeks: period.biWeeks ? period.biWeeks.map((bw: { _id: unknown }) => bw._id) : [],
            // [LEGADO] Mantido para compatibilidade
            dataInicio: period.startDate,
            dataFim: period.endDate,
            tipoPeriodo: period.periodType === 'bi-week' ? 'quinzenal' : 'customizado'
        });

        logger.debug(`[PIService] Documento PI antes de salvar: ${JSON.stringify(novaPI.toObject(), null, 2)}`);

        try {
            await novaPI.save();
            
            logger.info(`[PIService] PI salva com sucesso. ID: ${novaPI._id}, Code: ${piCode}, Placas no documento: ${novaPI.placas?.length || 0}`);
            logger.debug(`[PIService] Verificando se deve criar aluguéis...`);
            logger.debug(`[PIService] novaPI.placas: ${JSON.stringify(novaPI.placas)}`);
            logger.debug(`[PIService] novaPI.clienteId: ${novaPI.clienteId}`);
            logger.debug(`[PIService] period: ${JSON.stringify(period)}`);
            
            // Criar aluguéis automaticamente para as placas
            if (novaPI.placas && novaPI.placas.length > 0) {
                logger.info(`[PIService] ✅ Condição atendida: Criando aluguéis para ${novaPI.placas.length} placas`);
                await this._criarAlugueisParaPI(
                    novaPI._id,
                    piCode,
                    novaPI.clienteId, // Usar clienteId do documento salvo
                    novaPI.placas,
                    period, // [PERÍODO UNIFICADO] Passa objeto period completo
                    empresaId
                );
            } else {
                logger.warn(`[PIService] ⚠️ Nenhuma placa para criar aluguéis! Placas: ${novaPI.placas?.length || 0}`);
            }
            
            await novaPI.populate([
                { path: 'clienteId', select: 'nome email telefone cnpj responsavel segmento' },
                { path: 'placas', select: 'numero_placa nomeDaRua' } // Popula placas no retorno
            ]);
            return novaPI.toJSON();
        } catch (error: unknown) {
            logger.error(`[PIService] Erro ao criar PI: ${getErrorMessage(error)}`, { stack: getErrorStack(error) });
            throw new AppError(`Erro interno ao criar proposta: ${getErrorMessage(error)}`, 500);
        }
    }

    /**
     * Busca uma PI pelo ID (Usado para o PDF)
     */
    async getById(piId: string, empresaId: string): Promise<any> {
        const pi = await PropostaInterna.findOne({ _id: piId, empresaId: empresaId })
            .populate('clienteId') // Popula todos os campos do cliente
            .populate({
                path: 'placas', // Popula as placas
                select: 'numero_placa codigo tipo regiao nomeDaRua tamanho', // Incluído nomeDaRua e tamanho para o PDF
                populate: { path: 'regiao', select: 'nome' } // Popula a região dentro da placa
            })
            .lean();
            
        if (!pi) {
            throw new AppError('Proposta Interna (PI) não encontrada.', 404);
        }
        return pi;
    }

    /**
     * Lista todas as PIs (Usado pela tabela principal)
     */
    async getAll(empresaId: string, queryParams: PIListQueryParams): Promise<any> {
        const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc', status, clienteId } = queryParams;

        const pageInt = parseInt(String(page), 10);
        const limitInt = parseInt(String(limit), 10);
        const skip = (pageInt - 1) * limitInt;
        const sortOrder = order === 'desc' ? -1 : 1;

        // Whitelist para campos de ordenação.
        const camposOrdenaveis = ['createdAt', 'updatedAt', 'dataInicio', 'dataFim', 'valorTotal', 'status'];
        const campoOrdenacaoFinal = camposOrdenaveis.includes(sortBy) ? sortBy : 'createdAt';

        const query: Record<string, any> = { empresaId: empresaId };
        if (status) query.status = status;
        if (clienteId) query.clienteId = clienteId;
        
        try {
            const [pis, totalDocs] = await Promise.all([
                PropostaInterna.find(query)
                    // Selecionamos os campos novos para que o "Editar" funcione
                    .select('clienteId tipoPeriodo dataInicio dataFim valorTotal status formaPagamento placas descricao periodType startDate endDate biWeekIds') // Campos unificados
                    .populate({
                        path: 'clienteId',
                        select: 'nome responsavel segmento' // Dados para o auto-fill do modal
                    })
                    .populate({
                        path: 'cliente', // Virtual field para compatibilidade com frontend
                        select: 'nome responsavel segmento'
                    })
                    .sort({ [campoOrdenacaoFinal]: sortOrder })
                    .skip(skip)
                    .limit(limitInt)
                    .lean(),
                PropostaInterna.countDocuments(query)
            ]);

            const totalPages = Math.ceil(totalDocs / limitInt);
            const pagination = { totalDocs, totalPages, currentPage: pageInt, limit: limitInt };

            return { data: pis, pagination };
        } catch (error: unknown) {
            logger.error(`[PIService] Erro ao listar PIs: ${getErrorMessage(error)}`, { stack: getErrorStack(error) });
            throw new AppError(`Erro interno ao listar propostas: ${getErrorMessage(error)}`, 500);
        }
    }

    /**
     * Atualiza uma PI
     * [PERÍODO UNIFICADO] Processa período se fornecido
     */
    async update(piId: string, updateData: PIUpdateData, empresaId: string): Promise<any> {
        if (updateData.cliente) {
            await this._validateCliente(updateData.cliente, empresaId);
        }

        // Busca a PI atual para comparar as placas
        const piAtual = await PropostaInterna.findOne({ _id: piId, empresaId: empresaId }).lean() as any;
        if (!piAtual) {
            throw new AppError('PI não encontrada.', 404);
        }

        const placasAntigas = piAtual.placas?.map((p: ObjectIdLike) => p.toString()) || [];
        const placasNovas = updateData.placas?.map((p: ObjectIdLike) => p.toString()) || [];

        // [PERÍODO UNIFICADO] Processar período se fornecido
        let period = null;
        const hasPeriodUpdate = updateData.periodType || updateData.startDate || updateData.endDate || 
                                updateData.biWeekIds || updateData.dataInicio || updateData.dataFim;
        
        if (hasPeriodUpdate) {
            try {
                logger.debug('[PIService] Processando novo período com PeriodService...');
                period = await PeriodService.processPeriodInput(updateData as any);
                
                logger.info(`[PIService] Novo período processado: Tipo=${period.periodType}`);
                logger.info(`[PIService] Datas: ${PeriodService.formatDate(period.startDate)} - ${PeriodService.formatDate(period.endDate)}`);
            } catch (periodError: unknown) {
                logger.error(`[PIService] Erro ao processar período: ${getErrorMessage(periodError)}`);
                throw periodError;
            }
        }

        // <-- CORREÇÃO CRÍTICA DE SEGURANÇA (MASS ASSIGNMENT) -->
        // Desestruture explicitamente APENAS os campos que podem ser atualizados.
        const {
            cliente,
            valorTotal,
            descricao,
            placas,
            formaPagamento
            // Note que 'status' e 'empresa' não estão aqui de propósito.
        } = updateData;

        // Crie um objeto limpo para a atualização
        const dadosParaAtualizar: Record<string, any> = {
            cliente,
            valorTotal,
            descricao,
            placas,
            formaPagamento
        };

        // [PERÍODO UNIFICADO] Adiciona campos de período se processado
        if (period) {
            dadosParaAtualizar.periodType = period.periodType;
            dadosParaAtualizar.startDate = period.startDate;
            dadosParaAtualizar.endDate = period.endDate;
            dadosParaAtualizar.biWeekIds = period.biWeekIds;
            dadosParaAtualizar.biWeeks = period.biWeeks ? period.biWeeks.map((bw: { _id: unknown }) => bw._id) : [];
            // [LEGADO] Compatibilidade
            dadosParaAtualizar.dataInicio = period.startDate;
            dadosParaAtualizar.dataFim = period.endDate;
            dadosParaAtualizar.tipoPeriodo = period.periodType === 'bi-week' ? 'quinzenal' : 'customizado';
        }

        // Remove quaisquer chaves 'undefined'
        Object.keys(dadosParaAtualizar).forEach(key => 
            dadosParaAtualizar[key] === undefined && delete dadosParaAtualizar[key]
        );
        // <-- FIM DA CORREÇÃO DE SEGURANÇA -->

        try {
            const piAtualizada = await PropostaInterna.findOneAndUpdate(
                { _id: piId, empresaId: empresaId },
                { $set: dadosParaAtualizar }, // <-- SEGURO
                { new: true, runValidators: true }
            )
            .populate([
                { path: 'clienteId', select: 'nome email telefone cnpj responsavel segmento' },
                { path: 'placas', select: 'numero_placa nomeDaRua' } // Popula placas no retorno
            ]) as any;

            if (!piAtualizada) {
                throw new AppError('PI não encontrada.', 404);
            }

            // Extrai o ID do cliente (pode vir populado do banco)
            const clienteId = piAtualizada.clienteId?._id || piAtualizada.clienteId;

            // Gerenciar aluguéis quando as placas mudam
            if (updateData.placas) {
                const placasRemovidas = placasAntigas.filter((p: string) => !placasNovas.includes(p));
                const placasAdicionadas = placasNovas.filter((p: string) => !placasAntigas.includes(p));

                logger.debug(`[PIService] Update PI: ${placasRemovidas.length} placas removidas, ${placasAdicionadas.length} placas adicionadas`);

                // Remove aluguéis das placas removidas usando pi_code para garantir consistência
                if (placasRemovidas.length > 0) {
                    const deleted = await Aluguel.deleteMany({
                        pi_code: piAtualizada.pi_code,
                        placaId: { $in: placasRemovidas }
                    });
                    logger.info(`[PIService] ${deleted.deletedCount} aluguéis removidos (pi_code: ${piAtualizada.pi_code})`);
                }

                // Cria aluguéis para placas adicionadas
                if (placasAdicionadas.length > 0) {
                    // [PERÍODO UNIFICADO] Usa período da PI atualizada
                    const periodParaAlugueis = {
                        periodType: piAtualizada.periodType || 'custom',
                        startDate: piAtualizada.startDate || piAtualizada.dataInicio,
                        endDate: piAtualizada.endDate || piAtualizada.dataFim,
                        biWeekIds: (piAtualizada as any).biWeekIds || [],
                        biWeeks: piAtualizada.biWeeks || []
                    };
                    
                    await this._criarAlugueisParaPI(
                        piId,
                        piAtualizada.pi_code,
                        clienteId,
                        placasAdicionadas,
                        periodParaAlugueis, // [PERÍODO UNIFICADO] Passa objeto period
                        empresaId
                    );
                }
            }

            // [PERÍODO UNIFICADO] Se as datas mudaram, atualiza todos os aluguéis usando pi_code
            if (period) {
                const updated = await Aluguel.updateMany(
                    {
                        pi_code: piAtualizada.pi_code
                    },
                    {
                        $set: {
                            // Novos campos
                            periodType: period.periodType,
                            startDate: period.startDate,
                            endDate: period.endDate,
                            biWeekIds: period.biWeekIds,
                            biWeeks: period.biWeeks ? period.biWeeks.map((bw: { _id: unknown }) => bw._id) : [],
                            // Legado
                            data_inicio: period.startDate,
                            data_fim: period.endDate,
                            bi_week_ids: period.biWeekIds,
                            bi_weeks: period.biWeeks ? period.biWeeks.map((bw: { _id: unknown }) => bw._id) : []
                        }
                    }
                );
                logger.info(`[PIService] ${updated.modifiedCount} aluguéis atualizados para PI ${piId} (pi_code: ${piAtualizada.pi_code})`);
            }

            return piAtualizada.toJSON();
        } catch (error: unknown) {
            logger.error(`[PIService] Erro ao atualizar PI ${piId}: ${getErrorMessage(error)}`, { stack: getErrorStack(error) });
            if (error instanceof AppError) throw error;
            throw new AppError(`Erro interno ao atualizar proposta: ${getErrorMessage(error)}`, 500);
        }
    }

    /**
     * Deleta uma PI
     */
    async delete(piId: string, empresaId: string): Promise<void> {
        try {
            // Busca a PI antes de deletar para pegar as placas
            const pi = await PropostaInterna.findOne({ _id: piId, empresaId: empresaId }).lean();
            
            if (!pi) {
                throw new AppError('PI não encontrada.', 404);
            }

            // Adicionar verificação se a PI está vinculada a um contrato?
            // const contrato = await Contrato.findOne({ pi: piId, empresa: empresaId });
            // if (contrato) {
            //    throw new AppError('Não é possível apagar uma PI que já gerou um contrato.', 400);
            // }
            
            
            
            const result = await PropostaInterna.deleteOne({ _id: piId, empresaId: empresaId });
            
            if (result.deletedCount === 0) {
                throw new AppError('PI não encontrada.', 404);
            }

            // Remove todos os aluguéis associados a esta PI usando pi_code para garantir consistência
            const alugueisRemovidos = await Aluguel.deleteMany({
                pi_code: pi.pi_code
            });
            logger.info(`[PIService] PI ${piId} deletada. ${alugueisRemovidos.deletedCount} aluguéis removidos (pi_code: ${pi.pi_code})`);
            
            // NOTA: Não modificamos o campo 'disponivel' das placas ao deletar
            // O campo 'disponivel' é apenas para manutenção manual
            // A disponibilidade real é calculada pela verificação de conflitos de datas
            
        } catch (error: unknown) {
            logger.error(`[PIService] Erro ao deletar PI ${piId}: ${getErrorMessage(error)}`, { stack: getErrorStack(error) });
            if (error instanceof AppError) throw error;
            throw new AppError(`Erro interno ao deletar proposta: ${getErrorMessage(error)}`, 500);
        }
    }

    /**
     * Gera e envia o PDF da PI
     */
    async generatePDF(piId: string, empresaId: string, userId: string, res: Response): Promise<void> {
        logger.debug(`[PIService] Gerando PDF para PI ${piId}. Buscando dados...`);
        try {
            // 1. Buscar todos os dados necessários
            const pi = await this.getById(piId, empresaId); 
            
            logger.debug(`[PIService] PI encontrada: ${pi._id}`);
            logger.debug(`[PIService] Cliente ID: ${pi.clienteId?._id || 'undefined'}`);
            logger.debug(`[PIService] Cliente nome: ${pi.clienteId?.nome || 'undefined'}`);
            
            const [empresa, user] = await Promise.all([
                Empresa.findById(empresaId)
                         .select('nome cnpj endereco bairro cidade telefone')
                         .lean(),
                User.findById(userId).lean()
            ]);

            if (!empresa) {
                throw new AppError('Empresa não encontrada.', 404);
            }
            
            if (!user) {
                throw new AppError('Usuário não encontrado.', 404);
            }
            
            if (!pi.clienteId) {
                throw new AppError('Cliente da PI não encontrado.', 404);
            }

            logger.debug(`[PIService] Empresa: ${empresa.nome}`);
            logger.debug(`[PIService] Usuário: ${user.nome}`);
            logger.debug(`[PIService] Chamando pdfService.generatePI_PDF...`);

            // 2. Chamar o serviço de PDF (pi.clienteId já está populado pelo getById)
            pdfService.generatePI_PDF(res, pi, pi.clienteId, empresa, user);

        } catch (error: unknown) {
            logger.error(`[PIService] Erro ao gerar PDF da PI ${piId}: ${getErrorMessage(error)}`, { stack: getErrorStack(error) });
            // Se o erro ocorrer antes do streaming, o errorHandler global pega
            if (error instanceof AppError) throw error;
            throw new AppError(`Erro interno ao gerar PDF: ${getErrorMessage(error)}`, 500);
        }
    }

    /**
     * Gera Excel da PI com dados preenchidos
     */
    async generateExcel(piId: string, empresaId: string, res: Response): Promise<void> {
        logger.debug(`[PIService] Gerando Excel para PI ${piId}...`);
        try {
            // 1. Buscar PI com dados completos
            const pi = await this.getById(piId, empresaId);

            if (!pi) {
                throw new AppError('PI não encontrada.', 404);
            }

            // 2. Buscar empresa
            const empresa = await Empresa.findById(empresaId)
                .select('nome cnpj endereco bairro cidade telefone')
                .lean();

            if (!empresa) {
                throw new AppError('Empresa não encontrada.', 404);
            }

            const empresaData = empresa as any;

            // 3. Preparar dados para o Excel

            const piData = {
                cliente: {
                    nome: pi.clienteId?.nome || 'N/A',
                    cnpj: pi.clienteId?.cnpj || 'N/A',
                    endereco: `${pi.clienteId?.endereco || ''}, ${pi.clienteId?.bairro || ''}, ${pi.clienteId?.cidade || ''}`.trim(),
                    telefone: pi.clienteId?.telefone || 'N/A',
                    responsavel: pi.clienteId?.responsavel || 'N/A',
                    segmento: pi.clienteId?.segmento || 'N/A'
                },
                empresa: {
                    nome: empresaData.nome || 'N/A',
                    cnpj: empresaData.cnpj || 'N/A',
                    endereco: `${empresaData.endereco || ''}, ${empresaData.bairro || ''}, ${empresaData.cidade || ''}`.trim(),
                    telefone: empresaData.telefone || 'N/A'
                },
                pi: {
                    numero: pi._id.toString(),
                    produto: pi.produto || 'OUTDOOR',
                    descricao: pi.descricao || 'N/A',
                    periodo: pi.descricaoPeriodo || pi.tipoPeriodo || 'MENSAL',
                    dataInicio: pi.dataInicio ? new Date(pi.dataInicio).toLocaleDateString('pt-BR') : 'N/A',
                    dataFim: pi.dataFim ? new Date(pi.dataFim).toLocaleDateString('pt-BR') : 'N/A',
                    formaPagamento: pi.formaPagamento || 'A combinar',
                    valorProducao: pi.valorProducao || 0,
                    valorTotal: pi.valorTotal || 0
                },
                placas: (pi.placas || []).map((placa: any) => ({
                    numero: placa.numero_placa || placa.codigo || 'N/A',
                    localizacao: `${placa.nomeDaRua || ''} - ${placa.regiao?.nome || ''}`.trim(),
                    tamanho: placa.tamanho || 'N/A'
                }))
            };

            // 4. Carrega o template Excel
            const templatePath = path.join(process.cwd(), '..', 'templates', 'PI.xlsx');
            
            logger.debug(`[PIService] Tentando carregar template de: ${templatePath}`);
            
            try {
                await fs.access(templatePath);
                logger.debug(`[PIService] Template encontrado`);
            } catch (err) {
                logger.error(`[PIService] Template não encontrado em: ${templatePath}`);
                throw new AppError('Template Excel não encontrado.', 500);
            }

            const workbook = await XlsxPopulate.fromFileAsync(templatePath);
            const sheet = workbook.sheet(0);
            
            logger.debug(`[PIService] Template carregado, preenchendo dados...`);

            // 5. Preenche os dados (simplificado, sem try/catch individual)
            sheet.cell('B3').value(piData.empresa.nome);
            sheet.cell('D3').value(piData.cliente.nome);
            sheet.cell('F3').value(piData.pi.produto);
            sheet.cell('H3').value(piData.pi.numero);
            
            sheet.cell('B5').value(piData.empresa.endereco);
            sheet.cell('D5').value(piData.cliente.endereco);
            sheet.cell('F5').value(new Date().toLocaleDateString('pt-BR'));
            sheet.cell('H5').value(piData.pi.periodo);
            
            sheet.cell('B7').value(`${piData.empresa.cnpj}\n${piData.empresa.telefone}`);
            sheet.cell('D7').value(`${piData.cliente.cnpj}\n${piData.cliente.telefone}`);
            sheet.cell('F7').value(piData.cliente.responsavel);
            sheet.cell('H7').value(piData.cliente.segmento);
            
            sheet.cell('B9').value('Atendimento');
            sheet.cell('D9').value(piData.pi.formaPagamento);
            sheet.cell('F9').value(piData.pi.dataInicio);
            sheet.cell('H9').value(piData.pi.dataFim);
            
            sheet.cell('B11').value(piData.pi.descricao);
            
            // Valores financeiros
            const valorVeiculacao = piData.pi.valorTotal - piData.pi.valorProducao;
            sheet.cell('F18').value(piData.pi.valorProducao);
            sheet.cell('F19').value(valorVeiculacao);
            sheet.cell('F20').value(piData.pi.valorTotal);

            // Placas
            if (piData.placas.length > 0) {
                const descricaoPlacas = piData.placas
                    .map((placa: any, idx: number) => `${idx + 1}. PLACA ${placa.numero} - ${placa.localizacao} (${placa.tamanho})`)
                    .join('\n');
                sheet.cell('B13').value(`PLACAS:\n${descricaoPlacas}`);
            }

            // 6. Gera o buffer
            const buffer = await workbook.outputAsync();

            // 7. Headers e envio
            const filename = `PI_${piId}_${piData.cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', buffer.length);

            res.send(buffer);
            logger.info(`[PIService] Excel ${filename} gerado com sucesso`);

        } catch (error: unknown) {
            logger.error(`[PIService] Erro ao gerar Excel da PI ${piId}: ${getErrorMessage(error)}`, { stack: getErrorStack(error) });
            if (error instanceof AppError) throw error;
            throw new AppError(`Erro interno ao gerar Excel: ${getErrorMessage(error)}`, 500);
        }
    }

    /**
     * Gera PDF da PI a partir do Excel (XLSX convertido para PDF)
     */
    async generatePDFFromExcel(piId: string, empresaId: string, res: Response): Promise<void> {
        logger.debug(`[PIService] Gerando PDF from Excel para PI ${piId}...`);
        try {
            // 1. Gerar o Excel em memória (mesmo código do generateExcel)
            const pi = await this.getById(piId, empresaId);

            if (!pi) {
                throw new AppError('PI não encontrada.', 404);
            }

            const empresa = await Empresa.findById(empresaId)
                .select('nome cnpj endereco bairro cidade telefone')
                .lean();

            if (!empresa) {
                throw new AppError('Empresa não encontrada.', 404);
            }

            const empresaData = empresa as any;

            const piData = {
                cliente: {
                    nome: pi.clienteId?.nome || 'N/A',
                    cnpj: pi.clienteId?.cnpj || 'N/A',
                    endereco: `${pi.clienteId?.endereco || ''}, ${pi.clienteId?.bairro || ''}, ${pi.clienteId?.cidade || ''}`.trim(),
                    telefone: pi.clienteId?.telefone || 'N/A',
                    responsavel: pi.clienteId?.responsavel || 'N/A',
                    segmento: pi.clienteId?.segmento || 'N/A'
                },
                empresa: {
                    nome: empresaData.nome || 'N/A',
                    cnpj: empresaData.cnpj || 'N/A',
                    endereco: `${empresaData.endereco || ''}, ${empresaData.bairro || ''}, ${empresaData.cidade || ''}`.trim(),
                    telefone: empresaData.telefone || 'N/A'
                },
                pi: {
                    numero: pi._id.toString(),
                    produto: pi.produto || 'OUTDOOR',
                    descricao: pi.descricao || 'N/A',
                    periodo: pi.descricaoPeriodo || pi.tipoPeriodo || 'MENSAL',
                    dataInicio: pi.dataInicio ? new Date(pi.dataInicio).toLocaleDateString('pt-BR') : 'N/A',
                    dataFim: pi.dataFim ? new Date(pi.dataFim).toLocaleDateString('pt-BR') : 'N/A',
                    formaPagamento: pi.formaPagamento || 'A combinar',
                    valorProducao: pi.valorProducao || 0,
                    valorTotal: pi.valorTotal || 0
                },
                placas: (pi.placas || []).map((placa: any) => ({
                    numero: placa.numero_placa || placa.codigo || 'N/A',
                    localizacao: `${placa.nomeDaRua || ''} - ${placa.regiao?.nome || ''}`.trim(),
                    tamanho: placa.tamanho || 'N/A'
                }))
            };

            const templatePath = path.join(process.cwd(), '..', 'templates', 'PI.xlsx');
            
            try {
                await fs.access(templatePath);
            } catch (err) {
                throw new AppError('Template Excel não encontrado.', 500);
            }

            const workbook = await XlsxPopulate.fromFileAsync(templatePath);
            const sheet = workbook.sheet(0);

            // Preenche dados
            sheet.cell('B3').value(piData.empresa.nome);
            sheet.cell('D3').value(piData.cliente.nome);
            sheet.cell('F3').value(piData.pi.produto);
            sheet.cell('H3').value(piData.pi.numero);
            sheet.cell('B5').value(piData.empresa.endereco);
            sheet.cell('D5').value(piData.cliente.endereco);
            sheet.cell('F5').value(new Date().toLocaleDateString('pt-BR'));
            sheet.cell('H5').value(piData.pi.periodo);
            sheet.cell('B7').value(`${piData.empresa.cnpj}\n${piData.empresa.telefone}`);
            sheet.cell('D7').value(`${piData.cliente.cnpj}\n${piData.cliente.telefone}`);
            sheet.cell('F7').value(piData.cliente.responsavel);
            sheet.cell('H7').value(piData.cliente.segmento);
            sheet.cell('B9').value('Atendimento');
            sheet.cell('D9').value(piData.pi.formaPagamento);
            sheet.cell('F9').value(piData.pi.dataInicio);
            sheet.cell('H9').value(piData.pi.dataFim);
            sheet.cell('B11').value(piData.pi.descricao);
            
            const valorVeiculacao = piData.pi.valorTotal - piData.pi.valorProducao;
            sheet.cell('F18').value(piData.pi.valorProducao);
            sheet.cell('F19').value(valorVeiculacao);
            sheet.cell('F20').value(piData.pi.valorTotal);

            if (piData.placas.length > 0) {
                const descricaoPlacas = piData.placas
                    .map((placa: any, idx: number) => `${idx + 1}. PLACA ${placa.numero} - ${placa.localizacao} (${placa.tamanho})`)
                    .join('\n');
                sheet.cell('B13').value(`PLACAS:\n${descricaoPlacas}`);
            }

            // 2. Gera buffer do Excel
            const xlsxBuffer = await workbook.outputAsync();

            // 3. Converte para PDF
            logger.debug(`[PIService] Convertendo Excel para PDF...`);
            const pdfBuffer = await convertXlsxBufferToPdf(xlsxBuffer, {
                orientation: 'landscape',
                format: 'A4'
            });

            // 4. Envia PDF
            const filename = `PI_${piId}_${piData.cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', pdfBuffer.length);

            res.send(pdfBuffer);
            logger.info(`[PIService] PDF (from Excel) ${filename} gerado com sucesso`);

        } catch (error: unknown) {
            logger.error(`[PIService] Erro ao gerar PDF from Excel da PI ${piId}: ${getErrorMessage(error)}`, { stack: getErrorStack(error) });
            if (error instanceof AppError) throw error;
            throw new AppError(`Erro interno ao gerar PDF: ${getErrorMessage(error)}`, 500);
        }
    }
    
    /**
     * [PARA O CRON JOB] Atualiza o status de PIs vencidas
     */
    static async updateVencidas(): Promise<void> {
        const hoje = new Date();
        logger.info(`[PIService-Cron] Verificando PIs vencidas... (Data: ${hoje.toISOString()})`);
        
        try {
            // Buscar PIs que venceram
            const pisVencidas = await PropostaInterna.find({
                status: 'em_andamento',
                dataFim: { $lt: hoje }
            }).lean();

            if (pisVencidas.length === 0) {
                return;
            }

            logger.info(`[PIService-Cron] ${pisVencidas.length} PIs vencidas encontradas.`);

            // Atualizar status para 'vencida'
            const result = await PropostaInterna.updateMany(
                { 
                    status: 'em_andamento', 
                    dataFim: { $lt: hoje }
                },
                { $set: { status: 'vencida' } }
            );

            logger.info(`[PIService-Cron] ${result.modifiedCount} PIs foram atualizadas para 'vencida'.`);
        } catch (error: unknown) {
             logger.error(`[PIService-Cron] Erro ao atualizar status de PIs vencidas: ${getErrorMessage(error)}`, { stack: getErrorStack(error) });
        }
    }
}

export default PIService;

