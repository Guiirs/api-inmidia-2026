// src/services/aluguelNotificationService.ts
import { Types } from 'mongoose';
import { IAluguel } from '../../types/models.d';
import logger from '@shared/container/logger';
import notificationService from '@shared/container/notification.service';
import webhookService from '@modules/webhooks/webhook.service';
import * as sseController from '@modules/system/sse/sse.controller';
import whatsappService from '@modules/whatsapp/whatsapp.service';
import Placa from '@modules/placas/Placa';
import Cliente from '@modules/clientes/Cliente';

// Constantes de tipos de notificação (replicadas para evitar dependência circular)
const NOTIFICATION_TYPES = {
  ALUGUEL_CRIADO: 'aluguel_criado',
  ALUGUEL_CANCELADO: 'aluguel_cancelado'
} as const;

/**
 * Serviço responsável por disparar todas as notificações relacionadas a aluguéis
 * Segue o padrão Observer/Publisher para desacoplar lógica de negócio de notificações
 */
class AluguelNotificationService {
  /**
   * Formata dados do aluguel para notificação
   */
  private formatNotificationData(aluguel: IAluguel, placaNumero?: string, clienteNome?: string) {
    return {
      aluguel_id: aluguel._id.toString(),
      placa: placaNumero || (typeof aluguel.placaId === 'object' && 'numero_placa' in aluguel.placaId 
        ? aluguel.placaId.numero_placa 
        : aluguel.placaId.toString()),
      cliente: clienteNome || (typeof aluguel.clienteId === 'object' && 'nome' in aluguel.clienteId
        ? aluguel.clienteId.nome
        : 'Cliente'),
      data_inicio: aluguel.startDate || aluguel.data_inicio,
      data_fim: aluguel.endDate || aluguel.data_fim,
      periodo_tipo: aluguel.periodType
    };
  }

  /**
   * Dispara notificação via WebSocket
   */
  private async notifyWebSocket(empresaId: string, eventType: string, data: any): Promise<void> {
    try {
      notificationService.notifyEmpresa(
        empresaId,
        eventType,
        data
      );
      logger.debug(`[AluguelNotificationService] WebSocket notificado: ${eventType}`);
    } catch (error: any) {
      logger.error(`[AluguelNotificationService] Erro ao notificar via WebSocket: ${error.message}`);
    }
  }

  /**
   * Dispara notificação via SSE (Server-Sent Events)
   */
  private async notifySSE(empresaId: string, eventType: string, data: any): Promise<void> {
    try {
      sseController.notificarEmpresa(empresaId, eventType, data);
      logger.debug(`[AluguelNotificationService] SSE notificado: ${eventType}`);
    } catch (error: any) {
      logger.error(`[AluguelNotificationService] Erro ao notificar via SSE: ${error.message}`);
    }
  }

  /**
   * Dispara webhook assíncrono
   */
  private async notifyWebhook(empresaId: string, eventType: string, data: any): Promise<void> {
    try {
      await webhookService.disparar(empresaId, eventType, data);
      logger.debug(`[AluguelNotificationService] Webhook disparado: ${eventType}`);
    } catch (error: any) {
      logger.error(`[AluguelNotificationService] Erro ao disparar webhook: ${error.message}`);
    }
  }

  /**
   * Dispara notificação via WhatsApp (se habilitado)
   */
  private async notifyWhatsApp(
    aluguel: IAluguel,
    placaId: Types.ObjectId,
    clienteId: Types.ObjectId
  ): Promise<void> {
    try {
      if (process.env.WHATSAPP_ENABLED !== 'true') {
        logger.debug('[AluguelNotificationService] WhatsApp desabilitado. Notificação não enviada.');
        return;
      }

      logger.info('[AluguelNotificationService] WhatsApp habilitado! Buscando dados para notificação...');

      const [placaCompleta, clienteCompleto] = await Promise.all([
        Placa.findById(placaId).populate('regiao', 'nome').exec(),
        Cliente.findById(clienteId).exec()
      ]);

      if (!placaCompleta || !clienteCompleto) {
        logger.warn(
          `[AluguelNotificationService] Dados incompletos para WhatsApp. ` +
          `Placa: ${!!placaCompleta}, Cliente: ${!!clienteCompleto}`
        );
        return;
      }

      logger.info(
        `[AluguelNotificationService] Enviando WhatsApp: Placa ${placaCompleta.numero_placa}, ` +
        `Cliente ${clienteCompleto.nome}`
      );

      await whatsappService.notificarNovoAluguel(aluguel, placaCompleta, clienteCompleto);
      logger.debug('[AluguelNotificationService] WhatsApp enviado com sucesso');
    } catch (error: any) {
      logger.error(`[AluguelNotificationService] Erro ao enviar WhatsApp: ${error.message}`);
    }
  }

  /**
   * Dispara todas as notificações para criação de aluguel
   * Não lança exceções - apenas loga erros
   */
  async notifyAluguelCriado(
    aluguel: IAluguel,
    empresaId: Types.ObjectId,
    placaNumero?: string,
    clienteNome?: string
  ): Promise<void> {
    logger.info(`[AluguelNotificationService] Disparando notificações para aluguel ${aluguel._id}`);

    const empresaIdStr = empresaId.toString();
    const notificacaoData = this.formatNotificationData(aluguel, placaNumero, clienteNome);

    // Dispara todas as notificações em paralelo (fire and forget)
    const promises = [
      this.notifyWebSocket(empresaIdStr, NOTIFICATION_TYPES.ALUGUEL_CRIADO, notificacaoData),
      this.notifySSE(empresaIdStr, 'aluguel_criado', notificacaoData),
      this.notifyWebhook(empresaIdStr, 'aluguel_criado', notificacaoData),
    ];

    // WhatsApp requer dados adicionais
    if (process.env.WHATSAPP_ENABLED === 'true') {
      const placaId = typeof aluguel.placaId === 'object' ? aluguel.placaId._id : aluguel.placaId;
      const clienteId = typeof aluguel.clienteId === 'object' ? aluguel.clienteId._id : aluguel.clienteId;
      promises.push(this.notifyWhatsApp(aluguel, placaId, clienteId));
    }

    // Aguarda todas as notificações sem falhar a operação
    await Promise.allSettled(promises);

    logger.info(`[AluguelNotificationService] Notificações concluídas para aluguel ${aluguel._id}`);
  }

  /**
   * Dispara notificações para cancelamento de aluguel
   */
  async notifyAluguelCancelado(
    aluguelId: string,
    empresaId: Types.ObjectId,
    placaNumero?: string,
    clienteNome?: string
  ): Promise<void> {
    logger.info(`[AluguelNotificationService] Disparando notificações de cancelamento para ${aluguelId}`);

    const empresaIdStr = empresaId.toString();
    const notificacaoData = {
      aluguel_id: aluguelId,
      placa: placaNumero || 'Desconhecida',
      cliente: clienteNome || 'Desconhecido'
    };

    const promises = [
      this.notifyWebSocket(empresaIdStr, NOTIFICATION_TYPES.ALUGUEL_CANCELADO, notificacaoData),
      this.notifySSE(empresaIdStr, 'aluguel_cancelado', notificacaoData),
      this.notifyWebhook(empresaIdStr, 'aluguel_cancelado', notificacaoData),
    ];

    await Promise.allSettled(promises);

    logger.info(`[AluguelNotificationService] Notificações de cancelamento concluídas para ${aluguelId}`);
  }
}

export default new AluguelNotificationService();
