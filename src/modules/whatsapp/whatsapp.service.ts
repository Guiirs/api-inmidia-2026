/**
 * WhatsApp Service
 * Integração com WhatsApp Web.js
 * NOTA: Este módulo foi simplificado na refatoração. Funcionalidade completa mantida no original.
 */

import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import logger from '../../shared/container/logger';
import Placa from '../../modules/placas/Placa';
import Aluguel from '../../modules/alugueis/Aluguel';

/**
 * Serviço de integração com WhatsApp Web
 * Envia relatórios diários de disponibilidade de placas
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
        this.groupId = '120363425517091266@g.us'; // ID fixo como valor inicial de segurança
        this.currentQr = null; // Armazena o QR code atual
        this.connectedNumber = null; // Armazena o número conectado
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = null;
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

            // Evento: QR Code para autenticação
            this.client.on('qr', async (qr) => {
                this.currentQr = qr;
                logger.info('[WhatsApp] 📱 QR Code gerado para autenticação');
                
                // Emite QR code via SSE para todos os usuários conectados
                try {
                    await this.emitQrCodeToFrontend(qr);
                } catch (error: any) {
                    logger.error(`[WhatsApp] Erro ao emitir QR code: ${error.message}`);
                }
                
                // QR Code gerado com sucesso
                if (process.env.NODE_ENV === 'development') {
                    qrcode.generate(qr, { small: true });
                }
                
                logger.info('[WhatsApp] Aguardando leitura do QR Code...');
            });

            // Evento: Cliente autenticado
            this.client.on('authenticated', () => {
                logger.info('[WhatsApp] ✅ Cliente autenticado com sucesso!');
            });

            // Evento: Cliente pronto
            this.client.on('ready', async () => {
                this.isReady = true;
                
                // Captura informações do número conectado
                try {
                    const info = this.client?.info;
                    if (!info) {
                        throw new Error('Cliente sem info de sessao');
                    }
                    this.connectedNumber = info.wid.user;
                    logger.info(`[WhatsApp] 🚀 Cliente WhatsApp pronto! Conectado como: ${this.connectedNumber}`);
                    
                    // Emite status de conexão via SSE
                    await this.emitConnectionStatusToFrontend('connected', this.connectedNumber);
                    
                    // Reseta tentativas de reconexão
                    this.reconnectAttempts = 0;
                    
                } catch (error: any) {
                    logger.warn(`[WhatsApp] Não foi possível obter informações do número: ${error.message}`);
                    logger.info('[WhatsApp] 🚀 Cliente WhatsApp pronto para enviar mensagens!');
                }
                
                // Busca o grupo configurado em background com timeout
                setTimeout(async () => {
                    try {
                        await this.findGroup();
                    } catch (error: any) {
                        logger.error(`[WhatsApp] Erro ao buscar grupo: ${error.message}`);
                    }
                }, 1000); // Aguarda 1 segundo antes de buscar grupos
            });

            // Evento: Mensagem recebida (para comandos)
            this.client.on('message', async (message) => {
                await this.handleMessage(message);
            });

            // Evento: Desconexão
            this.client.on('disconnected', async (reason) => {
                this.isReady = false;
                this.connectedNumber = null;
                this.currentQr = null;
                
                logger.warn(`[WhatsApp] ⚠️ Cliente desconectado: ${reason}`);
                
                // Emite status de desconexão via SSE
                try {
                    await this.emitConnectionStatusToFrontend('disconnected', null);
                } catch (err: any) {
                    logger.error(`[WhatsApp] Erro ao emitir status de desconexão: ${err.message}`);
                }
                
                // Inicia reconexão automática se não atingiu o limite
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    logger.info(`[WhatsApp] 🔄 Iniciando reconexão automática (tentativa ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
                    this.scheduleReconnect();
                } else {
                    logger.error(`[WhatsApp] ❌ Máximo de tentativas de reconexão atingido (${this.maxReconnectAttempts})`);
                }
            });

            // Evento: Erro de autenticação
            this.client.on('auth_failure', async (msg) => {
                this.isReady = false;
                this.connectedNumber = null;
                this.currentQr = null;
                
                logger.error(`[WhatsApp] ❌ Falha na autenticação: ${msg}`);
                
                // Emite status de falha de autenticação via SSE
                try {
                    await this.emitConnectionStatusToFrontend('auth_failure', null);
                } catch (err: any) {
                    logger.error(`[WhatsApp] Erro ao emitir status de falha: ${err.message}`);
                }
                
                // Inicia reconexão automática após falha de autenticação
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    logger.info(`[WhatsApp] 🔄 Iniciando reconexão após falha de autenticação (tentativa ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
                    this.scheduleReconnect();
                } else {
                    logger.error(`[WhatsApp] ❌ Máximo de tentativas de reconexão atingido após falha de autenticação`);
                }
            });

            // Evento: Erros gerais do Puppeteer/WhatsApp
            this.client.on('remote_session_saved', () => {
                logger.info('[WhatsApp] 💾 Sessão remota salva');
            });

            // Captura erros não tratados do Puppeteer
            if (this.client.pupBrowser) {
                this.client.pupBrowser.on('disconnected', () => {
                    logger.warn('[WhatsApp] 🔌 Puppeteer browser desconectado');
                });
            }

            // Inicializa o cliente
            await this.client.initialize();

        } catch (error: any) {
            logger.error(`[WhatsApp] Erro ao inicializar: ${error.message}`);
            
            // Se for erro de Puppeteer, não propaga
            if (error.message.includes('Protocol error') || 
                error.message.includes('Session closed') ||
                error.message.includes('Target closed')) {
                logger.warn('[WhatsApp] Erro do Puppeteer detectado - operação será tentada novamente');
                this.scheduleReconnect();
                return; // Não lança erro
            }
            
            throw error;
        }
    }

    /**
     * Busca o grupo pelo nome ou usa o primeiro grupo encontrado
     */
    async findGroup() {
        try {
            const NOME_GRUPO = process.env.WHATSAPP_GROUP_NAME || 'Placas Disponíveis';
            const GROUP_ID_FALLBACK = '120363425517091266@g.us'; // ID fixo como segurança
            
            const chats = await this.client!.getChats();
            const groups = chats.filter(chat => chat.isGroup);

            logger.info(`[WhatsApp] Encontrados ${groups.length} grupos`);

            // Tenta encontrar o grupo pelo nome
            const targetGroup = groups.find(group => 
                group.name.toLowerCase().includes(NOME_GRUPO.toLowerCase())
            );

            if (targetGroup) {
                this.groupId = targetGroup.id._serialized;
                logger.info(`[WhatsApp] ✅ Grupo encontrado por nome: "${targetGroup.name}" (${this.groupId})`);
            } else {
                // Se não encontrar pelo nome, usa o ID fixo como segurança
                logger.warn(`[WhatsApp] ⚠️ Grupo "${NOME_GRUPO}" não encontrado por nome.`);
                logger.info(`[WhatsApp] 🔒 Usando ID fixo de segurança: ${GROUP_ID_FALLBACK}`);
                this.groupId = GROUP_ID_FALLBACK;
                
                // Verifica se o grupo com ID fixo existe
                const groupById = groups.find(g => g.id._serialized === GROUP_ID_FALLBACK);
                if (groupById) {
                    logger.info(`[WhatsApp] ✅ Grupo verificado: "${groupById.name}"`);
                } else {
                    logger.warn(`[WhatsApp] ⚠️ ID fixo não encontrado nos grupos disponíveis`);
                }
            }
        } catch (error: any) {
            logger.error(`[WhatsApp] Erro ao buscar grupo: ${error.message}`);
            // Em caso de erro, usa o ID fixo como último recurso
            this.groupId = '120363425517091266@g.us';
            logger.info(`[WhatsApp] 🔒 Usando ID fixo de emergência`);
        }
    }

    /**
     * Trata mensagens recebidas (comandos)
     */
    async handleMessage(message: any) {
        try {
            const body = message.body.toLowerCase().trim();
            
            // Ignora mensagens vazias ou que não são comandos
            if (!body.startsWith('!')) return;
            
            logger.info(`[WhatsApp] 📩 Comando recebido: "${body}"`);
            
            // Comando: !placas
            if (body === '!placas' || body === '!disponibilidade') {
                logger.info(`[WhatsApp] Verificando permissões do usuário...`);
                const isAdmin = await this.isUserAdmin(message);
                
                if (!isAdmin) {
                    logger.warn(`[WhatsApp] Usuário sem permissão de admin`);
                    await message.reply('⚠️ Apenas administradores podem solicitar o relatório.');
                    return;
                }

                logger.info(`[WhatsApp] Enviando confirmação...`);
                await message.reply('🔄 Gerando relatório de disponibilidade...');
                
                logger.info(`[WhatsApp] Gerando e enviando relatório...`);
                const sucesso = await this.enviarRelatorioDisponibilidade(message.from);
                
                if (sucesso) {
                    logger.info(`[WhatsApp] ✅ Relatório enviado com sucesso!`);
                } else {
                    logger.error(`[WhatsApp] ❌ Falha ao enviar relatório`);
                    await message.reply('❌ Erro ao gerar relatório. Tente novamente.');
                }
            }
            
            // Comando: !help
            else if (body === '!help' || body === '!ajuda') {
                logger.info(`[WhatsApp] Enviando ajuda...`);
                const helpText = `
📋 *Comandos Disponíveis:*

!placas - Exibe relatório de disponibilidade
!disponibilidade - Alias para !placas
!help - Mostra esta ajuda

💡 O relatório diário é enviado automaticamente todos os dias às ${process.env.WHATSAPP_REPORT_HOUR || '09:00'}h
                `.trim();
                
                await message.reply(helpText);
                logger.info(`[WhatsApp] ✅ Ajuda enviada`);
            }
        } catch (error: any) {
            logger.error(`[WhatsApp] Erro ao processar mensagem: ${error.message}`);
            try {
                await message.reply('❌ Erro ao processar comando. Tente novamente.');
            } catch (replyError: any) {
                logger.error(`[WhatsApp] Erro ao enviar mensagem de erro: ${replyError.message}`);
            }
        }
    }

    /**
     * Verifica se usuário é admin do grupo
     */
    async isUserAdmin(message: any) {
        try {
            const chat = await message.getChat();
            if (!chat.isGroup) return true; // Mensagens privadas sempre permitidas
            
            // Busca o participante pelo ID do autor da mensagem
            const authorId = message.author || message.from;
            const participant = chat.participants.find((p: any) => p.id._serialized === authorId);
            
            if (!participant) {
                logger.warn(`[WhatsApp] Participante não encontrado para verificar permissão`);
                return true; // Permite por padrão se não conseguir verificar
            }
            
            return participant.isAdmin || participant.isSuperAdmin;
        } catch (error: any) {
            logger.error(`[WhatsApp] Erro ao verificar admin: ${error.message}`);
            return true; // Permite por padrão em caso de erro
        }
    }

    /**
     * Gera relatório de disponibilidade de placas
     */
    async gerarRelatorio(empresaId: string | null = null) {
        try {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);

            logger.info(`[WhatsApp] Gerando relatório de disponibilidade para data: ${hoje.toISOString()}`);

            // Busca todas as placas
            const query = empresaId ? { empresaId: empresaId } : {};
            const placas = await Placa.find(query)
                .populate('regiaoId', 'nome')
                .sort({ numero_placa: 1 })
                .lean();

            logger.info(`[WhatsApp] Encontradas ${placas.length} placas no total`);

            // Busca aluguéis ativos hoje (considera timezone)
            const alugueisAtivos = await Aluguel.find({
                ...(empresaId && { empresaId: empresaId }),
                data_inicio: { $lte: hoje },
                data_fim: { $gte: hoje }
            })
            .populate('placaId', '_id numero_placa')
            .populate('clienteId', 'nome')
            .lean() as any[];

            logger.info(`[WhatsApp] Encontrados ${alugueisAtivos.length} aluguéis ativos`);
            
            if (alugueisAtivos.length > 0) {
                logger.debug(`[WhatsApp] Aluguéis ativos (primeiros 3):`, 
                    alugueisAtivos.slice(0, 3).map((a: any) => ({
                        placa: a.placaId?.numero_placa || a.placaId,
                        cliente: a.clienteId?.nome,
                        inicio: a.data_inicio,
                        fim: a.data_fim
                    }))
                );
            }

            // Mapeia placas alugadas com seus detalhes
            const placasAlugadasMap = new Map();
            
            alugueisAtivos.forEach((aluguel: any) => {
                if (aluguel.placaId) {
                    const placaId = typeof aluguel.placaId === 'object' 
                        ? aluguel.placaId._id.toString() 
                        : aluguel.placaId.toString();
                    
                    placasAlugadasMap.set(placaId, {
                        cliente: aluguel.clienteId?.nome || 'Cliente Desconhecido',
                        data_inicio: aluguel.data_inicio,
                        data_fim: aluguel.data_fim
                    });
                }
            });

            // Separa placas por status
            const disponiveisSemAluguel: any[] = [];
            const alugadas: any[] = [];
            const indisponiveis: any[] = [];

            placas.forEach(placa => {
                const placaId = placa._id.toString();
                const infoAluguel = placasAlugadasMap.get(placaId);

                if (infoAluguel) {
                    // Placa está alugada
                    alugadas.push({
                        ...placa,
                        cliente: infoAluguel.cliente,
                        data_inicio: infoAluguel.data_inicio,
                        data_fim: infoAluguel.data_fim
                    });
                } else if (placa.disponivel === false) {
                    // Placa marcada como indisponível manualmente
                    logger.debug(`[WhatsApp] Placa ${placa.numero_placa} marcada como indisponível (disponivel=false)`);
                    indisponiveis.push(placa);
                } else {
                    // Placa disponível para aluguel
                    disponiveisSemAluguel.push(placa);
                }
            });

            logger.info(`[WhatsApp] Separadas: ${disponiveisSemAluguel.length} disponíveis, ${alugadas.length} alugadas, ${indisponiveis.length} indisponíveis`);
            
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
        } catch (error: any) {
            const err = error as Error;
            logger.error(`[WhatsApp] Erro ao gerar relatório: ${err.message}`);
            throw error;
        }
    }

    /**
     * Formata relatório para WhatsApp (agrupado por regiões - versão simplificada)
     */
    formatarMensagem(relatorio: any): string {
        const { total, disponiveis, alugadas, indisponiveis } = relatorio;
        
        const dataHoraFormatada = new Date().toLocaleString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        let mensagem = `📊 *RELATÓRIO DE DISPONIBILIDADE*\n`;
        mensagem += `_Atualizado em ${dataHoraFormatada}_\n\n`;

        // Resumo
        mensagem += `📈 *RESUMO GERAL*\n`;
        mensagem += `• Total: ${total} placas\n`;
        mensagem += `• Disponíveis: ✅ ${disponiveis.length}\n`;
        mensagem += `• Alugadas: 🟡 ${alugadas.length}\n`;
        mensagem += `• Indisponíveis: ❌ ${indisponiveis.length}\n\n`;

        // Placas Disponíveis (agrupadas por região)
        if (disponiveis.length > 0) {
            mensagem += `✅ *PLACAS DISPONÍVEIS (${disponiveis.length})*\n\n`;
            
            // Agrupa por região
            const porRegiao: Record<string, string[]> = {};
            disponiveis.forEach((placa: any) => {
                const regiao = placa.regiao?.nome || 'Sem região';
                if (!porRegiao[regiao]) {
                    porRegiao[regiao] = [];
                }
                porRegiao[regiao].push(placa.numero_placa);
            });

            // Lista por região
            Object.keys(porRegiao).sort().forEach(regiao => {
                const placas = (porRegiao[regiao] || []).sort();
                mensagem += `📍 *${regiao}* (${placas.length})\n`;
                mensagem += `${placas.join(', ')}\n\n`;
            });
        }

        // Placas Alugadas (agrupadas por região)
        if (alugadas.length > 0) {
            mensagem += `🟡 *PLACAS ALUGADAS (${alugadas.length})*\n\n`;
            
            // Agrupa por região
            const porRegiao: Record<string, any[]> = {};
            alugadas.forEach((placa: any) => {
                const regiao = placa.regiao?.nome || 'Sem região';
                if (!porRegiao[regiao]) {
                    porRegiao[regiao] = [];
                }
                porRegiao[regiao].push({
                    numero: placa.numero_placa,
                    cliente: placa.cliente,
                    data_fim: placa.data_fim
                });
            });

            // Lista por região
            Object.keys(porRegiao).sort().forEach(regiao => {
                const placas = porRegiao[regiao] || [];
                mensagem += `📍 *${regiao}* (${placas.length})\n`;
                placas.forEach((p: any) => {
                    const dataFim = new Date(p.data_fim).toLocaleDateString('pt-PT');
                    mensagem += `• ${p.numero} - ${p.cliente} (até ${dataFim})\n`;
                });
                mensagem += `\n`;
            });
        }

        // Placas Indisponíveis (agrupadas por região)
        if (indisponiveis.length > 0) {
            mensagem += `❌ *PLACAS INDISPONÍVEIS (${indisponiveis.length})*\n\n`;
            
            // Agrupa por região
            const porRegiao: Record<string, string[]> = {};
            indisponiveis.forEach((placa: any) => {
                const regiao = placa.regiao?.nome || 'Sem região';
                if (!porRegiao[regiao]) {
                    porRegiao[regiao] = [];
                }
                porRegiao[regiao].push(placa.numero_placa);
            });

            // Lista por região
            Object.keys(porRegiao).sort().forEach(regiao => {
                const placas = (porRegiao[regiao] || []).sort();
                mensagem += `📍 *${regiao}* (${placas.length})\n`;
                mensagem += `${placas.join(', ')}\n\n`;
            });
        }

        mensagem += `_Sistema de Gestão de Placas_`;

        return mensagem;
    }

    /**
     * Envia relatório de disponibilidade
     */
    async enviarRelatorioDisponibilidade(chatId = null) {
        try {
            if (!this.isReady) {
                logger.warn('[WhatsApp] Cliente não está pronto. Ignorando envio.');
                return false;
            }

            const targetChatId = chatId || this.groupId;
            
            // Se não tiver groupId configurado, tenta buscar novamente
            if (!targetChatId) {
                logger.warn('[WhatsApp] Grupo não configurado. Tentando buscar...');
                await this.findGroup();
                
                if (!this.groupId) {
                    logger.error('[WhatsApp] Nenhum chat/grupo configurado para envio.');
                    return false;
                }
            }

            const finalChatId = chatId || this.groupId;
            logger.info(`[WhatsApp] Gerando relatório de disponibilidade...`);
            
            // Gera relatório
            const relatorio = await this.gerarRelatorio();
            const mensagem = this.formatarMensagem(relatorio);

            // Envia mensagem
            await this.client!.sendMessage(finalChatId, mensagem);
            
            logger.info(`[WhatsApp] ✅ Relatório enviado com sucesso para ${finalChatId}`);
            return true;

        } catch (error: any) {
            const err = error as Error;
            logger.error(`[WhatsApp] Erro ao enviar relatório: ${err.message}`);
            return false;
        }
    }

    /**
     * Envia mensagem customizada
     */
    async enviarMensagem(mensagem: string, chatId: string | null = null): Promise<boolean> {
        try {
            if (!this.isReady) {
                logger.warn('[WhatsApp] Cliente não está pronto.');
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

        } catch (error: any) {
            const err = error as Error;
            logger.error(`[WhatsApp] Erro ao enviar mensagem: ${err.message}`);
            return false;
        }
    }

    /**
     * Envia notificação de novo aluguel
     * @param {Object} aluguel - Dados do aluguel
     * @param {Object} placa - Dados da placa
     * @param {Object} cliente - Dados do cliente
     */
    async notificarNovoAluguel(aluguel: any, placa: any, cliente: any): Promise<boolean> {
        try {
            logger.info(`[WhatsApp] 🔔 notificarNovoAluguel chamada! Placa: ${placa?.numero_placa}, Cliente: ${cliente?.nome}`);
            logger.info(`[WhatsApp] Estado: isReady=${this.isReady}, groupId=${this.groupId}`);
            
            if (!this.isReady) {
                logger.warn('[WhatsApp] ⚠️ Cliente não está pronto. Notificação de aluguel não enviada.');
                logger.warn('[WhatsApp] Dica: Aguarde o WhatsApp inicializar completamente antes de criar aluguéis.');
                return false;
            }

            if (!this.groupId) {
                logger.error('[WhatsApp] ❌ Grupo não configurado. Notificação não enviada.');
                return false;
            }

            // Formata as datas
            const dataInicio = new Date(aluguel.data_inicio).toLocaleDateString('pt-PT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            
            const dataFim = new Date(aluguel.data_fim).toLocaleDateString('pt-PT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });

            // Calcula duração em dias
            const inicio = new Date(aluguel.data_inicio);
            const fim = new Date(aluguel.data_fim);
            const diferencaDias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));

            // Monta a mensagem
            const regiao = placa.regiao?.nome || 'Sem região';
            
            let mensagem = `🆕 *NOVO ALUGUEL REGISTRADO*\n\n`;
            mensagem += `📋 *Placa:* ${placa.numero_placa}\n`;
            mensagem += `📍 *Região:* ${regiao}\n`;
            mensagem += `👤 *Cliente:* ${cliente.nome}\n\n`;
            mensagem += `📅 *Período do Aluguel:*\n`;
            mensagem += `• Início: ${dataInicio}\n`;
            mensagem += `• Término: ${dataFim}\n`;
            mensagem += `• Duração: ${diferencaDias} dias\n\n`;
            mensagem += `_Sistema de Gestão de Placas_`;

            // Envia para o grupo
            await this.client!.sendMessage(this.groupId, mensagem);
            
            logger.info(`[WhatsApp] ✅ Notificação de aluguel enviada: ${placa.numero_placa} para ${cliente.nome}`);
            return true;

        } catch (error: any) {
            const err = error as Error;
            logger.error(`[WhatsApp] Erro ao enviar notificação de aluguel: ${err.message}`);
            return false;
        }
    }

    /**
     * Emite QR code para o frontend via SSE
     */
    async emitQrCodeToFrontend(qrCode: string): Promise<void> {
        try {
            // Importa dinamicamente para evitar dependências circulares
            const { notificarAdmins } = await import('../../modules/system/sse/sse.controller');
            
            notificarAdmins('whatsapp_qr', {
                qrCode,
                timestamp: new Date().toISOString(),
                status: 'waiting_scan'
            });
            
            logger.debug('[WhatsApp] QR code emitido via SSE');
        } catch (error: any) {
            const err = error as Error;
            logger.error(`[WhatsApp] Erro ao emitir QR code via SSE: ${err.message}`);
        }
    }

    /**
     * Emite status de conexão para o frontend via SSE
     */
    async emitConnectionStatusToFrontend(status: string, connectedNumber: string | null = null): Promise<void> {
        try {
            // Importa dinamicamente para evitar dependências circulares
            const { notificarAdmins } = await import('../../modules/system/sse/sse.controller');
            
            notificarAdmins('whatsapp_status', {
                status, // 'connected', 'disconnected', 'auth_failure'
                connectedNumber,
                timestamp: new Date().toISOString(),
                qrCode: status === 'disconnected' || status === 'auth_failure' ? null : this.currentQr
            });
            
            logger.debug(`[WhatsApp] Status de conexão emitido via SSE: ${status}`);
        } catch (error: any) {
            const err = error as Error;
            logger.error(`[WhatsApp] Erro ao emitir status via SSE: ${err.message}`);
        }
    }

    /**
     * Agenda reconexão automática
     */
    scheduleReconnect() {
        if (this.reconnectInterval) {
            clearTimeout(this.reconnectInterval);
        }
        
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
        
        logger.info(`[WhatsApp] ⏰ Reconexão agendada em ${delay/1000}s (tentativa ${this.reconnectAttempts})`);
        
        this.reconnectInterval = setTimeout(async () => {
            try {
                logger.info(`[WhatsApp] 🔄 Executando reconexão automática...`);
                await this.destroy();
                await this.initialize();
            } catch (error: any) {
                const err = error as Error;
                logger.error(`[WhatsApp] Erro na reconexão automática: ${err.message}`);
                
                // Se ainda não atingiu o limite, agenda nova tentativa
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.scheduleReconnect();
                }
            }
        }, delay);
    }

    /**
     * Cancela reconexão automática
     */
    cancelReconnect() {
        if (this.reconnectInterval) {
            clearTimeout(this.reconnectInterval);
            this.reconnectInterval = null;
            logger.info('[WhatsApp] Reconexão automática cancelada');
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
                logger.info('[WhatsApp] Cliente destruído');
            }
            
            this.isReady = false;
            this.connectedNumber = null;
            this.currentQr = null;
            
        } catch (error: any) {
            const err = error as Error;
            logger.error(`[WhatsApp] Erro ao destruir cliente: ${err.message}`);
        }
    }

    /**
     * Obtém status completo do WhatsApp
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
     * @param {string} phoneNumber - Número do telefone do cliente
     * @param {string} pdfPath - Caminho do arquivo PDF
     * @param {Object} contrato - Dados do contrato
     */
    async sendPDFToClient(phoneNumber: string, pdfPath: string, contrato: any): Promise<boolean> {
        try {
            logger.info(`[WhatsApp] 📄 Enviando PDF para cliente: ${phoneNumber}`);

            if (!this.isReady) {
                logger.warn('[WhatsApp] ⚠️ Cliente não está pronto. PDF não enviado.');
                return false;
            }

            // Formatar número para WhatsApp
            const chatId = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber.replace('+', '')}@c.us`;

            // Verificar se o arquivo existe
            const fs = await import('fs/promises');
            try {
                await fs.access(pdfPath);
            } catch (error: any) {
                logger.error(`[WhatsApp] Arquivo PDF não encontrado: ${pdfPath}`);
                return false;
            }

            // Ler o arquivo PDF (apenas para criar media)
            const { MessageMedia } = await import('whatsapp-web.js');

            // Criar media do PDF
            const media = MessageMedia.fromFilePath(pdfPath);

            // Criar mensagem
            const nomeCliente = contrato.clienteId?.nome || 'Cliente';
            const numeroContrato = contrato.numero_contrato || contrato._id;

            let mensagem = `📄 *CONTRATO GERADO COM SUCESSO*\n\n`;
            mensagem += `👤 *Cliente:* ${nomeCliente}\n`;
            mensagem += `📋 *Contrato:* ${numeroContrato}\n`;
            mensagem += `📅 *Data:* ${new Date().toLocaleDateString('pt-PT')}\n\n`;
            mensagem += `Segue em anexo o PDF do seu contrato.\n\n`;
            mensagem += `_Sistema de Gestão de Placas_`;

            // Enviar mensagem com PDF
            await this.client!.sendMessage(chatId, media, { caption: mensagem });

            logger.info(`[WhatsApp] ✅ PDF enviado com sucesso para ${phoneNumber}`);
            return true;

        } catch (error: any) {
            const err = error as Error;
            logger.error(`[WhatsApp] Erro ao enviar PDF: ${err.message}`);
            return false;
        }
    }

    /**
     * Cleanup seguro do cliente WhatsApp
     */
    async cleanup() {
        try {
            logger.info('[WhatsApp] 🧹 Iniciando cleanup do cliente...');

            if (this.client) {
                // Tenta fechar o browser do Puppeteer
                try {
                    if (this.client.pupBrowser) {
                        await this.client.pupBrowser.close();
                        logger.info('[WhatsApp] Puppeteer browser fechado');
                    }
                } catch (err: any) {
                    const error = err as Error;
                    logger.warn(`[WhatsApp] Erro ao fechar browser: ${error.message}`);
                }

                // Tenta destruir o cliente
                try {
                    await this.client.destroy();
                    logger.info('[WhatsApp] Cliente destruído');
                } catch (err: any) {
                    const error = err as Error;
                    logger.warn(`[WhatsApp] Erro ao destruir cliente: ${error.message}`);
                }

                this.client = null;
            }

            this.isReady = false;
            this.connectedNumber = null;
            this.currentQr = null;

            logger.info('[WhatsApp] ✅ Cleanup concluído');
        } catch (error: any) {
            const err = error as Error;
            logger.error(`[WhatsApp] Erro durante cleanup: ${err.message}`);
        }
    }
}

// Exporta singleton
export default new WhatsAppService();



