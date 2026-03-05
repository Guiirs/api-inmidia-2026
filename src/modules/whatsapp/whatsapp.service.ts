/**
 * WhatsApp Service
 * IntegraÃ§Ã£o com WhatsApp Web.js
 * NOTA: Este mÃ³dulo foi simplificado na refatoraÃ§Ã£o. Funcionalidade completa mantida no original.
 */

import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import logger from '../../shared/container/logger';
import Placa from '../../modules/placas/Placa';
import Aluguel from '../../modules/alugueis/Aluguel';

interface IncomingChatParticipant {
    id: { _serialized: string };
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
}

interface IncomingChat {
    isGroup: boolean;
    participants: IncomingChatParticipant[];
}

interface IncomingMessage {
    body: string;
    from: string;
    author?: string;
    reply: (text: string) => Promise<unknown>;
    getChat: () => Promise<unknown>;
}

interface AluguelAtivoLean {
    placaId?: { _id?: { toString(): string }; numero_placa?: string; toString(): string } | string;
    clienteId?: { nome?: string };
    data_inicio?: Date | string;
    data_fim?: Date | string;
}

interface PlacaRelatorio {
    _id: { toString(): string };
    numero_placa: string;
    disponivel?: boolean;
    regiao?: { nome?: string };
    cliente?: string;
    data_inicio?: Date | string;
    data_fim?: Date | string;
}

interface RelatorioDisponibilidade {
    total: number;
    disponiveis: PlacaRelatorio[];
    alugadas: PlacaRelatorio[];
    indisponiveis: PlacaRelatorio[];
    data: Date;
}

interface AluguelNotificationData {
    data_inicio?: Date | string;
    data_fim?: Date | string;
}

interface PlacaNotificationData {
    numero_placa: string;
    regiao?: unknown;
}

interface ClienteNotificationData {
    nome: string;
}

interface ContratoNotificationData {
    clienteId?: { nome?: string };
    numero_contrato?: string;
    _id?: string;
}

/**
 * ServiÃ§o de integraÃ§Ã£o com WhatsApp Web
 * Envia relatÃ³rios diÃ¡rios de disponibilidade de placas
 */
class WhatsAppService {
    client: Client | null;
    isReady: boolean;
    groupId: string;
    currentQr: string | null;
    connectedNumber: string | null;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
    reconnectInterval: NodeJS.Timeout | null;

    constructor() {
        this.client = null;
        this.isReady = false;
        this.groupId = '120363425517091266@g.us'; // ID fixo como valor inicial de seguranÃ§a
        this.currentQr = null; // Armazena o QR code atual
        this.connectedNumber = null; // Armazena o nÃºmero conectado
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = null;
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }

    /**
     * Inicializa o cliente WhatsApp
     */
    async initialize() {
        try {
            logger.info('[WhatsApp] Inicializando cliente WhatsApp Web...');

            this.client = new Client({
                authStrategy: new LocalAuth({
                    dataPath: './whatsapp-session'
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu'
                    ]
                }
            });

            // Evento: QR Code para autenticaÃ§Ã£o
            this.client.on('qr', async (qr) => {
                this.currentQr = qr;
                logger.info('[WhatsApp] ðŸ“± QR Code gerado para autenticaÃ§Ã£o');
                
                // Emite QR code via SSE para todos os usuÃ¡rios conectados
                try {
                    await this.emitQrCodeToFrontend(qr);
                } catch (error: unknown) {
                    logger.error(`[WhatsApp] Erro ao emitir QR code: ${this.getErrorMessage(error)}`);
                }
                
                // QR Code gerado com sucesso
                if (process.env.NODE_ENV === 'development') {
                    qrcode.generate(qr, { small: true });
                }
                
                logger.info('[WhatsApp] Aguardando leitura do QR Code...');
            });

            // Evento: Cliente autenticado
            this.client.on('authenticated', () => {
                logger.info('[WhatsApp] âœ… Cliente autenticado com sucesso!');
            });

            // Evento: Cliente pronto
            this.client.on('ready', async () => {
                this.isReady = true;
                
                // Captura informaÃ§Ãµes do nÃºmero conectado
                try {
                    const info = this.client?.info;
                    if (!info) {
                        throw new Error('Cliente sem info de sessao');
                    }
                    this.connectedNumber = info.wid.user;
                    logger.info(`[WhatsApp] ðŸš€ Cliente WhatsApp pronto! Conectado como: ${this.connectedNumber}`);
                    
                    // Emite status de conexÃ£o via SSE
                    await this.emitConnectionStatusToFrontend('connected', this.connectedNumber);
                    
                    // Reseta tentativas de reconexÃ£o
                    this.reconnectAttempts = 0;
                    
                } catch (error: unknown) {
                    logger.warn(`[WhatsApp] NÃ£o foi possÃ­vel obter informaÃ§Ãµes do nÃºmero: ${this.getErrorMessage(error)}`);
                    logger.info('[WhatsApp] ðŸš€ Cliente WhatsApp pronto para enviar mensagens!');
                }
                
                // Busca o grupo configurado em background com timeout
                setTimeout(async () => {
                    try {
                        await this.findGroup();
                    } catch (error: unknown) {
                        logger.error(`[WhatsApp] Erro ao buscar grupo: ${this.getErrorMessage(error)}`);
                    }
                }, 1000); // Aguarda 1 segundo antes de buscar grupos
            });

            // Evento: Mensagem recebida (para comandos)
            this.client.on('message', async (message) => {
                await this.handleMessage(message);
            });

            // Evento: DesconexÃ£o
            this.client.on('disconnected', async (reason) => {
                this.isReady = false;
                this.connectedNumber = null;
                this.currentQr = null;
                
                logger.warn(`[WhatsApp] Cliente desconectado: ${reason}`);
                
                // Emite status de desconexÃ£o via SSE
                try {
                    await this.emitConnectionStatusToFrontend('disconnected', null);
                } catch (err: unknown) {
                    logger.error(`[WhatsApp] Erro ao emitir status de desconexÃ£o: ${this.getErrorMessage(err)}`);
                }
                
                // Inicia reconexÃ£o automÃ¡tica se nÃ£o atingiu o limite
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    logger.info(`[WhatsApp] ðŸ”„ Iniciando reconexÃ£o automÃ¡tica (tentativa ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
                    this.scheduleReconnect();
                } else {
                    logger.error(`[WhatsApp] âŒ MÃ¡ximo de tentativas de reconexÃ£o atingido (${this.maxReconnectAttempts})`);
                }
            });

            // Evento: Erro de autenticaÃ§Ã£o
            this.client.on('auth_failure', async (msg) => {
                this.isReady = false;
                this.connectedNumber = null;
                this.currentQr = null;
                
                logger.error(`[WhatsApp] âŒ Falha na autenticaÃ§Ã£o: ${msg}`);
                
                // Emite status de falha de autenticaÃ§Ã£o via SSE
                try {
                    await this.emitConnectionStatusToFrontend('auth_failure', null);
                } catch (err: unknown) {
                    logger.error(`[WhatsApp] Erro ao emitir status de falha: ${this.getErrorMessage(err)}`);
                }
                
                // Inicia reconexÃ£o automÃ¡tica apÃ³s falha de autenticaÃ§Ã£o
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    logger.info(`[WhatsApp] ðŸ”„ Iniciando reconexÃ£o apÃ³s falha de autenticaÃ§Ã£o (tentativa ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
                    this.scheduleReconnect();
                } else {
                    logger.error(`[WhatsApp] âŒ MÃ¡ximo de tentativas de reconexÃ£o atingido apÃ³s falha de autenticaÃ§Ã£o`);
                }
            });

            // Evento: Erros gerais do Puppeteer/WhatsApp
            this.client.on('remote_session_saved', () => {
                logger.info('[WhatsApp] ðŸ’¾ SessÃ£o remota salva');
            });

            // Captura erros nÃ£o tratados do Puppeteer
            if (this.client.pupBrowser) {
                this.client.pupBrowser.on('disconnected', () => {
                    logger.warn('[WhatsApp] ðŸ”Œ Puppeteer browser desconectado');
                });
            }

            // Inicializa o cliente
            await this.client.initialize();

        } catch (error: unknown) {
            logger.error(`[WhatsApp] Erro ao inicializar: ${this.getErrorMessage(error)}`);
            
            // Se for erro de Puppeteer, nÃ£o propaga
            const errorMessage = this.getErrorMessage(error);
            if (errorMessage.includes('Protocol error') || 
                errorMessage.includes('Session closed') ||
                errorMessage.includes('Target closed')) {
                logger.warn('[WhatsApp] Erro do Puppeteer detectado - operaÃ§Ã£o serÃ¡ tentada novamente');
                this.scheduleReconnect();
                return; // NÃ£o lanÃ§a erro
            }
            
            throw error;
        }
    }

    /**
     * Busca o grupo pelo nome ou usa o primeiro grupo encontrado
     */
    async findGroup() {
        try {
            const NOME_GRUPO = process.env.WHATSAPP_GROUP_NAME || 'Placas DisponÃ­veis';
            const GROUP_ID_FALLBACK = '120363425517091266@g.us'; // ID fixo como seguranÃ§a
            
            const chats = await this.client!.getChats();
            const groups = chats.filter(chat => chat.isGroup);

            logger.info(`[WhatsApp] Encontrados ${groups.length} grupos`);

            // Tenta encontrar o grupo pelo nome
            const targetGroup = groups.find(group => 
                group.name.toLowerCase().includes(NOME_GRUPO.toLowerCase())
            );

            if (targetGroup) {
                this.groupId = targetGroup.id._serialized;
                logger.info(`[WhatsApp] âœ… Grupo encontrado por nome: "${targetGroup.name}" (${this.groupId})`);
            } else {
                // Se nÃ£o encontrar pelo nome, usa o ID fixo como seguranÃ§a
                logger.warn(`[WhatsApp] Grupo "${NOME_GRUPO}" nao encontrado por nome.`);
                logger.info(`[WhatsApp] ðŸ”’ Usando ID fixo de seguranÃ§a: ${GROUP_ID_FALLBACK}`);
                this.groupId = GROUP_ID_FALLBACK;
                
                // Verifica se o grupo com ID fixo existe
                const groupById = groups.find(g => g.id._serialized === GROUP_ID_FALLBACK);
                if (groupById) {
                    logger.info(`[WhatsApp] âœ… Grupo verificado: "${groupById.name}"`);
                } else {
                    logger.warn(`[WhatsApp] ID fixo nao encontrado nos grupos disponiveis`);
                }
            }
        } catch (error: unknown) {
            logger.error(`[WhatsApp] Erro ao buscar grupo: ${this.getErrorMessage(error)}`);
            // Em caso de erro, usa o ID fixo como Ãºltimo recurso
            this.groupId = '120363425517091266@g.us';
            logger.info(`[WhatsApp] ðŸ”’ Usando ID fixo de emergÃªncia`);
        }
    }

    /**
     * Trata mensagens recebidas (comandos)
     */
    async handleMessage(message: IncomingMessage): Promise<void> {
        try {
            const body = message.body.toLowerCase().trim();
            
            // Ignora mensagens vazias ou que nÃ£o sÃ£o comandos
            if (!body.startsWith('!')) return;
            
            logger.info(`[WhatsApp] ðŸ“© Comando recebido: "${body}"`);
            
            // Comando: !placas
            if (body === '!placas' || body === '!disponibilidade') {
                logger.info(`[WhatsApp] Verificando permissÃµes do usuÃ¡rio...`);
                const isAdmin = await this.isUserAdmin(message);
                
                if (!isAdmin) {
                    logger.warn(`[WhatsApp] UsuÃ¡rio sem permissÃ£o de admin`);
                    await message.reply('âš ï¸ Apenas administradores podem solicitar o relatÃ³rio.');
                    return;
                }

                logger.info(`[WhatsApp] Enviando confirmaÃ§Ã£o...`);
                await message.reply('ðŸ”„ Gerando relatÃ³rio de disponibilidade...');
                
                logger.info(`[WhatsApp] Gerando e enviando relatÃ³rio...`);
                const sucesso = await this.enviarRelatorioDisponibilidade(message.from);
                
                if (sucesso) {
                    logger.info(`[WhatsApp] âœ… RelatÃ³rio enviado com sucesso!`);
                } else {
                    logger.error(`[WhatsApp] âŒ Falha ao enviar relatÃ³rio`);
                    await message.reply('âŒ Erro ao gerar relatÃ³rio. Tente novamente.');
                }
            }
            
            // Comando: !help
            else if (body === '!help' || body === '!ajuda') {
                logger.info(`[WhatsApp] Enviando ajuda...`);
                const helpText = `
ðŸ“‹ *Comandos DisponÃ­veis:*

!placas - Exibe relatÃ³rio de disponibilidade
!disponibilidade - Alias para !placas
!help - Mostra esta ajuda

Dica: O relatorio diario e enviado automaticamente todos os dias as ${process.env.WHATSAPP_REPORT_HOUR || '09:00'}h
                `.trim();
                
                await message.reply(helpText);
                logger.info(`[WhatsApp] âœ… Ajuda enviada`);
            }
        } catch (error: unknown) {
            logger.error(`[WhatsApp] Erro ao processar mensagem: ${this.getErrorMessage(error)}`);
            try {
                await message.reply('âŒ Erro ao processar comando. Tente novamente.');
            } catch (replyError: unknown) {
                logger.error(`[WhatsApp] Erro ao enviar mensagem de erro: ${this.getErrorMessage(replyError)}`);
            }
        }
    }

    /**
     * Verifica se usuÃ¡rio Ã© admin do grupo
     */
    async isUserAdmin(message: IncomingMessage): Promise<boolean> {
        try {
            const chat = await message.getChat() as IncomingChat;
            if (!chat.isGroup) return true; // Mensagens privadas sempre permitidas
            
            // Busca o participante pelo ID do autor da mensagem
            const authorId = message.author || message.from;
            const participant = chat.participants.find((p: IncomingChatParticipant) => p.id._serialized === authorId);
            
            if (!participant) {
                logger.warn(`[WhatsApp] Participante nÃ£o encontrado para verificar permissÃ£o`);
                return true; // Permite por padrÃ£o se nÃ£o conseguir verificar
            }
            
            return Boolean(participant.isAdmin || participant.isSuperAdmin);
        } catch (error: unknown) {
            logger.error(`[WhatsApp] Erro ao verificar admin: ${this.getErrorMessage(error)}`);
            return true; // Permite por padrÃ£o em caso de erro
        }
    }

    /**
     * Gera relatÃ³rio de disponibilidade de placas
     */
    async gerarRelatorio(empresaId: string | null = null): Promise<RelatorioDisponibilidade> {
        try {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);

            logger.info(`[WhatsApp] Gerando relatÃ³rio de disponibilidade para data: ${hoje.toISOString()}`);

            // Busca todas as placas
            const query = empresaId ? { empresaId: empresaId } : {};
            const placas = await Placa.find(query)
                .populate('regiaoId', 'nome')
                .sort({ numero_placa: 1 })
                .lean() as PlacaRelatorio[];

            logger.info(`[WhatsApp] Encontradas ${placas.length} placas no total`);

            // Busca aluguÃ©is ativos hoje (considera timezone)
            const alugueisAtivos = await Aluguel.find({
                ...(empresaId && { empresaId: empresaId }),
                data_inicio: { $lte: hoje },
                data_fim: { $gte: hoje }
            })
            .populate('placaId', '_id numero_placa')
            .populate('clienteId', 'nome')
            .lean() as AluguelAtivoLean[];

            logger.info(`[WhatsApp] Encontrados ${alugueisAtivos.length} aluguÃ©is ativos`);
            
            if (alugueisAtivos.length > 0) {
                logger.debug(`[WhatsApp] AluguÃ©is ativos (primeiros 3):`, 
                    alugueisAtivos.slice(0, 3).map((a: AluguelAtivoLean) => ({
                        placa: typeof a.placaId === 'object' ? a.placaId.numero_placa : a.placaId,
                        cliente: a.clienteId?.nome,
                        inicio: a.data_inicio,
                        fim: a.data_fim
                    }))
                );
            }

            // Mapeia placas alugadas com seus detalhes
            const placasAlugadasMap = new Map();
            
            alugueisAtivos.forEach((aluguel: AluguelAtivoLean) => {
                if (aluguel.placaId) {
                    const placaId = typeof aluguel.placaId === 'object'
                        ? (aluguel.placaId._id ? aluguel.placaId._id.toString() : aluguel.placaId.toString())
                        : aluguel.placaId.toString();
                    
                    placasAlugadasMap.set(placaId, {
                        cliente: aluguel.clienteId?.nome || 'Cliente Desconhecido',
                        data_inicio: aluguel.data_inicio,
                        data_fim: aluguel.data_fim
                    });
                }
            });

            // Separa placas por status
            const disponiveisSemAluguel: PlacaRelatorio[] = [];
            const alugadas: PlacaRelatorio[] = [];
            const indisponiveis: PlacaRelatorio[] = [];

            placas.forEach(placa => {
                const placaId = placa._id.toString();
                const infoAluguel = placasAlugadasMap.get(placaId);

                if (infoAluguel) {
                    // Placa estÃ¡ alugada
                    alugadas.push({
                        ...placa,
                        cliente: infoAluguel.cliente,
                        data_inicio: infoAluguel.data_inicio,
                        data_fim: infoAluguel.data_fim
                    });
                } else if (placa.disponivel === false) {
                    // Placa marcada como indisponÃ­vel manualmente
                    logger.debug(`[WhatsApp] Placa ${placa.numero_placa} marcada como indisponÃ­vel (disponivel=false)`);
                    indisponiveis.push(placa);
                } else {
                    // Placa disponÃ­vel para aluguel
                    disponiveisSemAluguel.push(placa);
                }
            });

            logger.info(`[WhatsApp] Separadas: ${disponiveisSemAluguel.length} disponÃ­veis, ${alugadas.length} alugadas, ${indisponiveis.length} indisponÃ­veis`);
            
            if (alugadas.length > 0) {
                logger.debug(`[WhatsApp] Placas alugadas (primeiras 3):`, 
                    alugadas.slice(0, 3).map(p => ({
                        numero: p.numero_placa,
                        cliente: p.cliente,
                        ate: p.data_fim
                    }))
                );
            }

            return {
                total: placas.length,
                disponiveis: disponiveisSemAluguel,
                alugadas,
                indisponiveis,
                data: hoje
            };
        } catch (error: unknown) {
            const err = error as Error;
            logger.error(`[WhatsApp] Erro ao gerar relatÃ³rio: ${this.getErrorMessage(err)}`);
            throw error;
        }
    }

    /**
     * Formata relatÃ³rio para WhatsApp (agrupado por regiÃµes - versÃ£o simplificada)
     */
    formatarMensagem(relatorio: RelatorioDisponibilidade): string {
        const { total, disponiveis, alugadas, indisponiveis } = relatorio;
        
        const dataHoraFormatada = new Date().toLocaleString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        let mensagem = `ðŸ“Š *RELATÃ“RIO DE DISPONIBILIDADE*\n`;
        mensagem += `_Atualizado em ${dataHoraFormatada}_\n\n`;

        // Resumo
        mensagem += `ðŸ“ˆ *RESUMO GERAL*\n`;
        mensagem += `â€¢ Total: ${total} placas\n`;
        mensagem += `â€¢ DisponÃ­veis: âœ… ${disponiveis.length}\n`;
        mensagem += `â€¢ Alugadas: ðŸŸ¡ ${alugadas.length}\n`;
        mensagem += `â€¢ IndisponÃ­veis: âŒ ${indisponiveis.length}\n\n`;

        // Placas DisponÃ­veis (agrupadas por regiÃ£o)
        if (disponiveis.length > 0) {
            mensagem += `âœ… *PLACAS DISPONÃVEIS (${disponiveis.length})*\n\n`;
            
            // Agrupa por regiÃ£o
            const porRegiao: Record<string, string[]> = {};
            disponiveis.forEach((placa: PlacaRelatorio) => {
                const regiao = placa.regiao?.nome || 'Sem regiÃ£o';
                if (!porRegiao[regiao]) {
                    porRegiao[regiao] = [];
                }
                porRegiao[regiao].push(placa.numero_placa);
            });

            // Lista por regiÃ£o
            Object.keys(porRegiao).sort().forEach(regiao => {
                const placas = (porRegiao[regiao] || []).sort();
                mensagem += `ðŸ“ *${regiao}* (${placas.length})\n`;
                mensagem += `${placas.join(', ')}\n\n`;
            });
        }

        // Placas Alugadas (agrupadas por regiÃ£o)
        if (alugadas.length > 0) {
            mensagem += `ðŸŸ¡ *PLACAS ALUGADAS (${alugadas.length})*\n\n`;
            
            // Agrupa por regiÃ£o
            const porRegiao: Record<string, Array<{ numero: string; cliente?: string; data_fim?: Date | string }>> = {};
            alugadas.forEach((placa: PlacaRelatorio) => {
                const regiao = placa.regiao?.nome || 'Sem regiÃ£o';
                if (!porRegiao[regiao]) {
                    porRegiao[regiao] = [];
                }
                porRegiao[regiao].push({
                    numero: placa.numero_placa,
                    cliente: placa.cliente,
                    data_fim: placa.data_fim
                });
            });

            // Lista por regiÃ£o
            Object.keys(porRegiao).sort().forEach(regiao => {
                const placas = porRegiao[regiao] || [];
                mensagem += `ðŸ“ *${regiao}* (${placas.length})\n`;
                placas.forEach((p: { numero: string; cliente?: string; data_fim?: Date | string }) => {
                    const dataFim = new Date(p.data_fim || new Date()).toLocaleDateString('pt-PT');
                    mensagem += `â€¢ ${p.numero} - ${p.cliente} (atÃ© ${dataFim})\n`;
                });
                mensagem += `\n`;
            });
        }

        // Placas IndisponÃ­veis (agrupadas por regiÃ£o)
        if (indisponiveis.length > 0) {
            mensagem += `âŒ *PLACAS INDISPONÃVEIS (${indisponiveis.length})*\n\n`;
            
            // Agrupa por regiÃ£o
            const porRegiao: Record<string, string[]> = {};
            indisponiveis.forEach((placa: PlacaRelatorio) => {
                const regiao = placa.regiao?.nome || 'Sem regiÃ£o';
                if (!porRegiao[regiao]) {
                    porRegiao[regiao] = [];
                }
                porRegiao[regiao].push(placa.numero_placa);
            });

            // Lista por regiÃ£o
            Object.keys(porRegiao).sort().forEach(regiao => {
                const placas = (porRegiao[regiao] || []).sort();
                mensagem += `ðŸ“ *${regiao}* (${placas.length})\n`;
                mensagem += `${placas.join(', ')}\n\n`;
            });
        }

        mensagem += `_Sistema de GestÃ£o de Placas_`;

        return mensagem;
    }

    /**
     * Envia relatÃ³rio de disponibilidade
     */
    async enviarRelatorioDisponibilidade(chatId: string | null = null) {
        try {
            if (!this.isReady) {
                logger.warn('[WhatsApp] Cliente nÃ£o estÃ¡ pronto. Ignorando envio.');
                return false;
            }

            const targetChatId = chatId || this.groupId;
            
            // Se nÃ£o tiver groupId configurado, tenta buscar novamente
            if (!targetChatId) {
                logger.warn('[WhatsApp] Grupo nÃ£o configurado. Tentando buscar...');
                await this.findGroup();
                
                if (!this.groupId) {
                    logger.error('[WhatsApp] Nenhum chat/grupo configurado para envio.');
                    return false;
                }
            }

            const finalChatId = chatId || this.groupId;
            logger.info(`[WhatsApp] Gerando relatÃ³rio de disponibilidade...`);
            
            // Gera relatÃ³rio
            const relatorio = await this.gerarRelatorio();
            const mensagem = this.formatarMensagem(relatorio);

            // Envia mensagem
            await this.client!.sendMessage(finalChatId, mensagem);
            
            logger.info(`[WhatsApp] âœ… RelatÃ³rio enviado com sucesso para ${finalChatId}`);
            return true;

        } catch (error: unknown) {
            const err = error as Error;
            logger.error(`[WhatsApp] Erro ao enviar relatÃ³rio: ${this.getErrorMessage(err)}`);
            return false;
        }
    }

    /**
     * Envia mensagem customizada
     */
    async enviarMensagem(mensagem: string, chatId: string | null = null): Promise<boolean> {
        try {
            if (!this.isReady) {
                logger.warn('[WhatsApp] Cliente nÃ£o estÃ¡ pronto.');
                return false;
            }

            const targetChatId = chatId || this.groupId;
            
            if (!targetChatId) {
                logger.error('[WhatsApp] Nenhum chat configurado.');
                return false;
            }

            await this.client!.sendMessage(targetChatId, mensagem);
            logger.info(`[WhatsApp] Mensagem enviada: ${mensagem.substring(0, 50)}...`);
            return true;

        } catch (error: unknown) {
            const err = error as Error;
            logger.error(`[WhatsApp] Erro ao enviar mensagem: ${this.getErrorMessage(err)}`);
            return false;
        }
    }

    /**
     * Envia notificaÃ§Ã£o de novo aluguel
     * @param {Object} aluguel - Dados do aluguel
     * @param {Object} placa - Dados da placa
     * @param {Object} cliente - Dados do cliente
     */
    async notificarNovoAluguel(
        aluguel: AluguelNotificationData,
        placa: PlacaNotificationData,
        cliente: ClienteNotificationData
    ): Promise<boolean> {
        try {
            logger.info(`[WhatsApp] ðŸ”” notificarNovoAluguel chamada! Placa: ${placa?.numero_placa}, Cliente: ${cliente?.nome}`);
            logger.info(`[WhatsApp] Estado: isReady=${this.isReady}, groupId=${this.groupId}`);
            
            if (!this.isReady) {
                logger.warn('[WhatsApp] âš ï¸ Cliente nÃ£o estÃ¡ pronto. NotificaÃ§Ã£o de aluguel nÃ£o enviada.');
                logger.warn('[WhatsApp] Dica: Aguarde o WhatsApp inicializar completamente antes de criar aluguÃ©is.');
                return false;
            }

            if (!this.groupId) {
                logger.error('[WhatsApp] âŒ Grupo nÃ£o configurado. NotificaÃ§Ã£o nÃ£o enviada.');
                return false;
            }

            // Formata as datas
            const aluguelInicio = aluguel.data_inicio || new Date();
            const aluguelFim = aluguel.data_fim || new Date();

            const dataInicio = new Date(aluguelInicio).toLocaleDateString('pt-PT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            
            const dataFim = new Date(aluguelFim).toLocaleDateString('pt-PT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });

            // Calcula duraÃ§Ã£o em dias
            const inicio = new Date(aluguelInicio);
            const fim = new Date(aluguelFim);
            const diferencaDias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));

            // Monta a mensagem
            const regiao =
                typeof placa.regiao === 'object' &&
                placa.regiao !== null &&
                'nome' in placa.regiao &&
                typeof (placa.regiao as { nome?: unknown }).nome === 'string'
                    ? ((placa.regiao as { nome: string }).nome || 'Sem regiÃ£o')
                    : 'Sem regiÃ£o';
            
            let mensagem = `ðŸ†• *NOVO ALUGUEL REGISTRADO*\n\n`;
            mensagem += `ðŸ“‹ *Placa:* ${placa.numero_placa}\n`;
            mensagem += `ðŸ“ *RegiÃ£o:* ${regiao}\n`;
            mensagem += `ðŸ‘¤ *Cliente:* ${cliente.nome}\n\n`;
            mensagem += `ðŸ“… *PerÃ­odo do Aluguel:*\n`;
            mensagem += `â€¢ InÃ­cio: ${dataInicio}\n`;
            mensagem += `â€¢ TÃ©rmino: ${dataFim}\n`;
            mensagem += `â€¢ DuraÃ§Ã£o: ${diferencaDias} dias\n\n`;
            mensagem += `_Sistema de GestÃ£o de Placas_`;

            // Envia para o grupo
            await this.client!.sendMessage(this.groupId, mensagem);
            
            logger.info(`[WhatsApp] âœ… NotificaÃ§Ã£o de aluguel enviada: ${placa.numero_placa} para ${cliente.nome}`);
            return true;

        } catch (error: unknown) {
            const err = error as Error;
            logger.error(`[WhatsApp] Erro ao enviar notificaÃ§Ã£o de aluguel: ${this.getErrorMessage(err)}`);
            return false;
        }
    }

    /**
     * Emite QR code para o frontend via SSE
     */
    async emitQrCodeToFrontend(qrCode: string): Promise<void> {
        try {
            // Importa dinamicamente para evitar dependÃªncias circulares
            const { notificarAdmins } = await import('../../modules/system/sse/sse.controller');
            
            notificarAdmins('whatsapp_qr', {
                qrCode,
                timestamp: new Date().toISOString(),
                status: 'waiting_scan'
            });
            
            logger.debug('[WhatsApp] QR code emitido via SSE');
        } catch (error: unknown) {
            const err = error as Error;
            logger.error(`[WhatsApp] Erro ao emitir QR code via SSE: ${this.getErrorMessage(err)}`);
        }
    }

    /**
     * Emite status de conexÃ£o para o frontend via SSE
     */
    async emitConnectionStatusToFrontend(status: string, connectedNumber: string | null = null): Promise<void> {
        try {
            // Importa dinamicamente para evitar dependÃªncias circulares
            const { notificarAdmins } = await import('../../modules/system/sse/sse.controller');
            
            notificarAdmins('whatsapp_status', {
                status, // 'connected', 'disconnected', 'auth_failure'
                connectedNumber,
                timestamp: new Date().toISOString(),
                qrCode: status === 'disconnected' || status === 'auth_failure' ? null : this.currentQr
            });
            
            logger.debug(`[WhatsApp] Status de conexÃ£o emitido via SSE: ${status}`);
        } catch (error: unknown) {
            const err = error as Error;
            logger.error(`[WhatsApp] Erro ao emitir status via SSE: ${this.getErrorMessage(err)}`);
        }
    }

    /**
     * Agenda reconexÃ£o automÃ¡tica
     */
    scheduleReconnect() {
        if (this.reconnectInterval) {
            clearTimeout(this.reconnectInterval);
        }
        
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
        
        logger.info(`[WhatsApp] â° ReconexÃ£o agendada em ${delay/1000}s (tentativa ${this.reconnectAttempts})`);
        
        this.reconnectInterval = setTimeout(async () => {
            try {
                logger.info(`[WhatsApp] ðŸ”„ Executando reconexÃ£o automÃ¡tica...`);
                await this.destroy();
                await this.initialize();
            } catch (error: unknown) {
                const err = error as Error;
                logger.error(`[WhatsApp] Erro na reconexÃ£o automÃ¡tica: ${this.getErrorMessage(err)}`);
                
                // Se ainda nÃ£o atingiu o limite, agenda nova tentativa
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.scheduleReconnect();
                }
            }
        }, delay);
    }

    /**
     * Cancela reconexÃ£o automÃ¡tica
     */
    cancelReconnect() {
        if (this.reconnectInterval) {
            clearTimeout(this.reconnectInterval);
            this.reconnectInterval = null;
            logger.info('[WhatsApp] ReconexÃ£o automÃ¡tica cancelada');
        }
    }

    /**
     * Destroi o cliente WhatsApp
     */
    async destroy() {
        try {
            this.cancelReconnect();
            
            if (this.client) {
                await this.client.destroy();
                this.client = null;
                logger.info('[WhatsApp] Cliente destruÃ­do');
            }
            
            this.isReady = false;
            this.connectedNumber = null;
            this.currentQr = null;
            
        } catch (error: unknown) {
            const err = error as Error;
            logger.error(`[WhatsApp] Erro ao destruir cliente: ${this.getErrorMessage(err)}`);
        }
    }

    /**
     * ObtÃ©m status completo do WhatsApp
     */
    getStatus() {
        return {
            isReady: this.isReady,
            connectedNumber: this.connectedNumber,
            currentQr: this.currentQr,
            groupId: this.groupId,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts
        };
    }

    /**
     * Envia PDF do contrato para o cliente via WhatsApp
     * @param {string} phoneNumber - NÃºmero do telefone do cliente
     * @param {string} pdfPath - Caminho do arquivo PDF
     * @param {Object} contrato - Dados do contrato
     */
    async sendPDFToClient(phoneNumber: string, pdfPath: string, contrato: ContratoNotificationData): Promise<boolean> {
        try {
            logger.info(`[WhatsApp] ðŸ“„ Enviando PDF para cliente: ${phoneNumber}`);

            if (!this.isReady) {
                logger.warn('[WhatsApp] âš ï¸ Cliente nÃ£o estÃ¡ pronto. PDF nÃ£o enviado.');
                return false;
            }

            // Formatar nÃºmero para WhatsApp
            const chatId = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber.replace('+', '')}@c.us`;

            // Verificar se o arquivo existe
            const fs = await import('fs/promises');
            try {
                await fs.access(pdfPath);
            } catch (error: unknown) {
                logger.error(`[WhatsApp] Arquivo PDF nÃ£o encontrado: ${pdfPath}`);
                return false;
            }

            // Ler o arquivo PDF (apenas para criar media)
            const { MessageMedia } = await import('whatsapp-web.js');

            // Criar media do PDF
            const media = MessageMedia.fromFilePath(pdfPath);

            // Criar mensagem
            const nomeCliente = contrato.clienteId?.nome || 'Cliente';
            const numeroContrato = contrato.numero_contrato || contrato._id;

            let mensagem = `ðŸ“„ *CONTRATO GERADO COM SUCESSO*\n\n`;
            mensagem += `ðŸ‘¤ *Cliente:* ${nomeCliente}\n`;
            mensagem += `ðŸ“‹ *Contrato:* ${numeroContrato}\n`;
            mensagem += `ðŸ“… *Data:* ${new Date().toLocaleDateString('pt-PT')}\n\n`;
            mensagem += `Segue em anexo o PDF do seu contrato.\n\n`;
            mensagem += `_Sistema de GestÃ£o de Placas_`;

            // Enviar mensagem com PDF
            await this.client!.sendMessage(chatId, media, { caption: mensagem });

            logger.info(`[WhatsApp] âœ… PDF enviado com sucesso para ${phoneNumber}`);
            return true;

        } catch (error: unknown) {
            const err = error as Error;
            logger.error(`[WhatsApp] Erro ao enviar PDF: ${this.getErrorMessage(err)}`);
            return false;
        }
    }

    /**
     * Cleanup seguro do cliente WhatsApp
     */
    async cleanup() {
        try {
            logger.info('[WhatsApp] ðŸ§¹ Iniciando cleanup do cliente...');

            if (this.client) {
                // Tenta fechar o browser do Puppeteer
                try {
                    if (this.client.pupBrowser) {
                        await this.client.pupBrowser.close();
                        logger.info('[WhatsApp] Puppeteer browser fechado');
                    }
                } catch (err: unknown) {
                    const error = err as Error;
                    logger.warn(`[WhatsApp] Erro ao fechar browser: ${this.getErrorMessage(error)}`);
                }

                // Tenta destruir o cliente
                try {
                    await this.client.destroy();
                    logger.info('[WhatsApp] Cliente destruÃ­do');
                } catch (err: unknown) {
                    const error = err as Error;
                    logger.warn(`[WhatsApp] Erro ao destruir cliente: ${this.getErrorMessage(error)}`);
                }

                this.client = null;
            }

            this.isReady = false;
            this.connectedNumber = null;
            this.currentQr = null;

            logger.info('[WhatsApp] âœ… Cleanup concluÃ­do');
        } catch (error: unknown) {
            const err = error as Error;
            logger.error(`[WhatsApp] Erro durante cleanup: ${this.getErrorMessage(err)}`);
        }
    }
}

// Exporta singleton
export default new WhatsAppService();





