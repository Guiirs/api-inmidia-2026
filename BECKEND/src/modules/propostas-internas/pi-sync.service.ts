/**
 * PI Sync Service
 * PI <-> Alugueis synchronization and consistency checks
 */
// src/modules/propostas-internas/pi-sync.service.ts
import PropostaInterna from './PropostaInterna';
import Aluguel from '../alugueis/Aluguel';
import logger from '../../shared/container/logger';

type ObjectIdLike = { toString(): string } | string;

interface PISyncLean {
    _id: ObjectIdLike;
    pi_code: string;
    placas?: ObjectIdLike[];
    clienteId: ObjectIdLike;
    empresaId: ObjectIdLike;
    periodType?: string;
    startDate?: Date;
    endDate?: Date;
    dataInicio?: Date;
    dataFim?: Date;
    biWeekIds?: string[];
}

interface AluguelSyncLean {
    _id: ObjectIdLike;
    pi_code?: string;
    placaId: ObjectIdLike;
    clienteId: ObjectIdLike;
    empresaId: ObjectIdLike;
    startDate?: Date;
    endDate?: Date;
    data_inicio?: Date;
    data_fim?: Date;
}

interface PISyncValidationResult {
    temProblema: boolean;
    alugueisCorrigidos: number;
    alugueisCriados: number;
    alugueisOrfaosRemovidos: number;
    problemas: string[];
}

const toIdString = (value: ObjectIdLike | null | undefined): string => {
    if (value == null) return '';
    return typeof value === 'string' ? value : value.toString();
};

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return String(error);
};

class PISyncService {
    /**
     * Validate and sync PIs with their alugueis
     * Runs automatically every 30 minutes
     */
    static async syncPIsWithAlugueis(): Promise<void> {
        logger.info('[PISyncService] Iniciando validacao PI <-> Alugueis...');

        try {
            const pisAtivas = (await PropostaInterna.find({
                status: { $in: ['em_andamento', 'concluida'] }
            }).lean()) as unknown as PISyncLean[];

            if (pisAtivas.length === 0) {
                logger.info('[PISyncService] Nenhuma PI ativa para validar.');
                return;
            }

            logger.info(`[PISyncService] Validando ${pisAtivas.length} PIs ativas...`);

            let pisComProblemas = 0;
            let alugueisCorrigidos = 0;
            let alugueisOrfaosRemovidos = 0;
            let alugueisCriados = 0;

            for (const pi of pisAtivas) {
                try {
                    const resultado = await this._validatePI(pi);

                    if (resultado.temProblema) {
                        pisComProblemas++;
                        alugueisCorrigidos += resultado.alugueisCorrigidos;
                        alugueisCriados += resultado.alugueisCriados;
                        alugueisOrfaosRemovidos += resultado.alugueisOrfaosRemovidos;
                    }
                } catch (error: unknown) {
                    logger.error(`[PISyncService] Erro ao validar PI ${pi._id}: ${getErrorMessage(error)}`);
                }
            }

            logger.info('[PISyncService] Validacao concluida.');
            logger.info(`[PISyncService] PIs com problemas: ${pisComProblemas}`);
            logger.info(`[PISyncService] Alugueis criados: ${alugueisCriados}`);
            logger.info(`[PISyncService] Alugueis corrigidos: ${alugueisCorrigidos}`);
            logger.info(`[PISyncService] Alugueis orfaos removidos: ${alugueisOrfaosRemovidos}`);
        } catch (error: unknown) {
            logger.error(`[PISyncService] Erro na validacao geral: ${getErrorMessage(error)}`, {
                stack: error instanceof Error ? error.stack : undefined
            });
        }
    }

    /**
     * Validate a specific PI and fix inconsistencies
     */
    static async _validatePI(pi: PISyncLean): Promise<PISyncValidationResult> {
        const resultado: PISyncValidationResult = {
            temProblema: false,
            alugueisCorrigidos: 0,
            alugueisCriados: 0,
            alugueisOrfaosRemovidos: 0,
            problemas: []
        };

        const alugueisDaPI = (await Aluguel.find({
            pi_code: pi.pi_code
        }).lean()) as unknown as AluguelSyncLean[];

        const placasEsperadas = pi.placas?.length || 0;
        const alugueisEncontrados = alugueisDaPI.length;

        if (alugueisEncontrados !== placasEsperadas) {
            resultado.temProblema = true;
            resultado.problemas.push(
                `Divergencia: ${placasEsperadas} placas na PI, mas ${alugueisEncontrados} alugueis encontrados`
            );

            logger.warn(
                `[PISyncService] PI ${pi._id} (${pi.pi_code}): ${placasEsperadas} placas, ${alugueisEncontrados} alugueis`
            );

            if (alugueisEncontrados < placasEsperadas) {
                const placasComAluguel = alugueisDaPI.map((a) => toIdString(a.placaId));
                const placasSemAluguel = (pi.placas || []).filter(
                    (p) => !placasComAluguel.includes(toIdString(p))
                );

                if (placasSemAluguel.length > 0) {
                    logger.info(
                        `[PISyncService] Criando ${placasSemAluguel.length} alugueis faltantes para PI ${pi._id}`
                    );

                    const piStartDate = pi.startDate ?? pi.dataInicio;
                    const piEndDate = pi.endDate ?? pi.dataFim;
                    const periodType = pi.periodType || 'custom';

                    const novosAlugueis = placasSemAluguel.map((placaId) => ({
                        placaId,
                        clienteId: pi.clienteId,
                        empresaId: pi.empresaId,
                        periodType,
                        startDate: piStartDate,
                        endDate: piEndDate,
                        data_inicio: piStartDate,
                        data_fim: piEndDate,
                        biWeekIds: pi.biWeekIds || [],
                        pi_code: pi.pi_code,
                        proposta_interna: pi._id,
                        tipo: 'pi' as const,
                        status: 'ativo' as const
                    }));

                    await Aluguel.insertMany(novosAlugueis);
                    resultado.alugueisCriados = novosAlugueis.length;
                    logger.info(`[PISyncService] ${novosAlugueis.length} alugueis criados`);
                }
            }

            if (alugueisEncontrados > placasEsperadas) {
                const placasNaPI = (pi.placas || []).map((p) => toIdString(p));
                const alugueisOrfaos = alugueisDaPI.filter(
                    (a) => !placasNaPI.includes(toIdString(a.placaId))
                );

                if (alugueisOrfaos.length > 0) {
                    logger.info(
                        `[PISyncService] Removendo ${alugueisOrfaos.length} alugueis orfaos da PI ${pi._id}`
                    );

                    const idsOrfaos = alugueisOrfaos.map((a) => a._id);
                    await Aluguel.deleteMany({ _id: { $in: idsOrfaos } });
                    resultado.alugueisOrfaosRemovidos = alugueisOrfaos.length;
                    logger.info(`[PISyncService] ${alugueisOrfaos.length} alugueis orfaos removidos`);
                }
            }
        }

        const piStartDate = pi.startDate ?? pi.dataInicio;
        const piEndDate = pi.endDate ?? pi.dataFim;

        const alugueisComDataIncorreta = (!piStartDate || !piEndDate)
            ? []
            : alugueisDaPI.filter((a) => {
                const aluguelStart = a.startDate ?? a.data_inicio;
                const aluguelEnd = a.endDate ?? a.data_fim;

                if (!aluguelStart || !aluguelEnd) {
                    return true;
                }

                const dataInicioOk = new Date(aluguelStart).getTime() === new Date(piStartDate).getTime();
                const dataFimOk = new Date(aluguelEnd).getTime() === new Date(piEndDate).getTime();
                return !dataInicioOk || !dataFimOk;
            });

        if (alugueisComDataIncorreta.length > 0) {
            resultado.temProblema = true;
            resultado.problemas.push(`${alugueisComDataIncorreta.length} alugueis com datas incorretas`);

            logger.warn(
                `[PISyncService] PI ${pi._id} (${pi.pi_code}): ${alugueisComDataIncorreta.length} alugueis com datas incorretas`
            );
            logger.info('[PISyncService] Corrigindo datas dos alugueis...');

            await Aluguel.updateMany(
                { pi_code: pi.pi_code },
                {
                    $set: {
                        data_inicio: piStartDate,
                        data_fim: piEndDate,
                        startDate: piStartDate,
                        endDate: piEndDate
                    }
                }
            );
            resultado.alugueisCorrigidos = alugueisComDataIncorreta.length;
            logger.info(`[PISyncService] ${alugueisComDataIncorreta.length} datas corrigidas`);
        }

        const alugueisComClienteIncorreto = alugueisDaPI.filter(
            (a) =>
                toIdString(a.clienteId) !== toIdString(pi.clienteId) ||
                toIdString(a.empresaId) !== toIdString(pi.empresaId)
        );

        if (alugueisComClienteIncorreto.length > 0) {
            resultado.temProblema = true;
            resultado.problemas.push(
                `${alugueisComClienteIncorreto.length} alugueis com cliente/empresa incorretos`
            );

            logger.warn(
                `[PISyncService] PI ${pi._id} (${pi.pi_code}): ${alugueisComClienteIncorreto.length} alugueis com cliente/empresa incorretos`
            );
            logger.info('[PISyncService] Corrigindo cliente/empresa dos alugueis...');

            await Aluguel.updateMany(
                { pi_code: pi.pi_code },
                {
                    $set: {
                        clienteId: pi.clienteId,
                        empresaId: pi.empresaId
                    }
                }
            );
            resultado.alugueisCorrigidos += alugueisComClienteIncorreto.length;
            logger.info(`[PISyncService] ${alugueisComClienteIncorreto.length} registros corrigidos`);
        }

        if (resultado.temProblema) {
            logger.info(`[PISyncService] PI ${pi._id} (${pi.pi_code}) - problemas encontrados e corrigidos:`);
            resultado.problemas.forEach((p) => logger.info(`[PISyncService] - ${p}`));
        }

        return resultado;
    }

    /**
     * Remove orphan alugueis (no matching PI)
     */
    static async cleanOrphanAlugueis(): Promise<void> {
        logger.info('[PISyncService] Limpando alugueis orfaos...');

        try {
            const alugueisPI = (await Aluguel.find({ tipo: 'pi' }).lean()) as unknown as AluguelSyncLean[];

            if (alugueisPI.length === 0) {
                logger.info('[PISyncService] Nenhum aluguel de PI para validar.');
                return;
            }

            logger.info(`[PISyncService] Verificando ${alugueisPI.length} alugueis de PIs...`);

            const orfaos: ObjectIdLike[] = [];

            for (const aluguel of alugueisPI) {
                if (!aluguel.pi_code) {
                    continue;
                }

                const piExiste = await PropostaInterna.exists({ pi_code: aluguel.pi_code });

                if (!piExiste) {
                    orfaos.push(aluguel._id);
                    logger.warn(
                        `[PISyncService] Aluguel orfao encontrado: ${aluguel._id} (pi_code: ${aluguel.pi_code})`
                    );
                }
            }

            if (orfaos.length > 0) {
                await Aluguel.deleteMany({ _id: { $in: orfaos } });
                logger.info(`[PISyncService] ${orfaos.length} alugueis orfaos removidos`);
            } else {
                logger.info('[PISyncService] Nenhum aluguel orfao encontrado');
            }
        } catch (error: unknown) {
            logger.error(`[PISyncService] Erro ao limpar alugueis orfaos: ${getErrorMessage(error)}`, {
                stack: error instanceof Error ? error.stack : undefined
            });
        }
    }
}

export default PISyncService;
