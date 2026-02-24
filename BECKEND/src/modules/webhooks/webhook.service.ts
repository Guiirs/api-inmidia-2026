/**
 * Webhook Service
 * Integracoes via webhooks
 */
// src/modules/webhooks/webhook.service.ts
import axios from 'axios';
import crypto from 'crypto';
import Webhook from './Webhook';
import logger from '../../shared/container/logger';

type WebhookDoc = any;
type WebhookPayload = Record<string, any>;

class WebhookService {
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  /**
   * Dispara webhook para evento especifico
   */
  async disparar(empresaId: string, evento: string, payload: WebhookPayload): Promise<void> {
    try {
      const webhooks = (await Webhook.find({
        empresa: empresaId,
        ativo: true,
        eventos: evento,
      }).select('+secret')) as WebhookDoc[];

      if (webhooks.length === 0) {
        logger.debug(`[WebhookService] Nenhum webhook ativo para evento ${evento} na empresa ${empresaId}`);
        return;
      }

      logger.info(`[WebhookService] Disparando ${webhooks.length} webhook(s) para evento: ${evento}`);

      const promises = webhooks.map((webhook: WebhookDoc) => this._dispararWebhook(webhook, evento, payload));
      await Promise.allSettled(promises);
    } catch (error: unknown) {
      logger.error(`[WebhookService] Erro ao disparar webhooks: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Dispara um webhook individual com retry
   */
  async _dispararWebhook(webhook: WebhookDoc, evento: string, payload: WebhookPayload): Promise<void> {
    const maxTentativas = webhook.retry_config?.max_tentativas || 3;
    const timeout = webhook.retry_config?.timeout_ms || 3000;

    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
      try {
        const webhookPayload = {
          evento,
          timestamp: new Date().toISOString(),
          data: payload,
          webhook_id: webhook._id,
        };

        const signature = this._gerarAssinatura(webhookPayload, webhook.secret);

        const headers = {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': evento,
          'X-Webhook-Tentativa': tentativa,
          'User-Agent': 'InMidia-Webhook/1.0',
          ...Object.fromEntries(webhook.headers || {}),
        };

        await axios.post(webhook.url, webhookPayload, {
          headers,
          timeout,
          validateStatus: (status: number) => status >= 200 && status < 300,
        });

        await webhook.registrarDisparo(true);
        logger.info(`[WebhookService] Webhook ${webhook.nome} disparado com sucesso (tentativa ${tentativa})`);
        return;
      } catch (error: any) {
        const detalhes = error?.response
          ? `HTTP ${error.response.status}: ${error.response.statusText}`
          : (error?.message || 'Erro desconhecido');

        logger.warn(`[WebhookService] Falha no webhook ${webhook.nome} (tentativa ${tentativa}/${maxTentativas}): ${detalhes}`);

        if (tentativa === maxTentativas) {
          await webhook.registrarDisparo(false, detalhes);
          logger.error(`[WebhookService] Webhook ${webhook.nome} falhou apos ${maxTentativas} tentativas`);
        }

        if (tentativa < maxTentativas) {
          await this._sleep(Math.pow(2, tentativa) * 1000);
        }
      }
    }
  }

  _gerarAssinatura(payload: WebhookPayload, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async criar(dados: WebhookPayload, userId: string): Promise<any> {
    try {
      const secret = crypto.randomBytes(32).toString('hex');

      const webhook = new Webhook({
        ...dados,
        secret,
        criado_por: userId,
      });

      await webhook.save();
      logger.info(`[WebhookService] Webhook criado: ${webhook.nome} (${webhook._id})`);

      const webhookObj = webhook.toObject() as Record<string, any>;
      delete webhookObj.secret;

      return webhookObj;
    } catch (error: unknown) {
      logger.error(`[WebhookService] Erro ao criar webhook: ${this.getErrorMessage(error)}`);
      throw error;
    }
  }

  async listar(empresaId: string, filtros: Record<string, any> = {}): Promise<any[]> {
    try {
      const query: Record<string, any> = { empresaId, ...filtros };
      const webhooks = await Webhook.find(query)
        .sort({ createdAt: -1 })
        .populate('criado_por', 'username email');

      return webhooks;
    } catch (error: unknown) {
      logger.error(`[WebhookService] Erro ao listar webhooks: ${this.getErrorMessage(error)}`);
      throw error;
    }
  }

  async atualizar(webhookId: string, empresaId: string, dados: Record<string, any>): Promise<any> {
    try {
      const webhook = await Webhook.findOne({ _id: webhookId, empresa: empresaId });

      if (!webhook) {
        throw new Error('Webhook nao encontrado');
      }

      const camposPermitidos = ['nome', 'url', 'eventos', 'ativo', 'retry_config', 'headers'];
      camposPermitidos.forEach((campo: string) => {
        if (dados[campo] !== undefined) {
          (webhook as any)[campo] = dados[campo];
        }
      });

      await webhook.save();
      logger.info(`[WebhookService] Webhook atualizado: ${webhook.nome} (${webhook._id})`);

      return webhook;
    } catch (error: unknown) {
      logger.error(`[WebhookService] Erro ao atualizar webhook: ${this.getErrorMessage(error)}`);
      throw error;
    }
  }

  async remover(webhookId: string, empresaId: string): Promise<boolean> {
    try {
      const resultado = await Webhook.deleteOne({ _id: webhookId, empresa: empresaId });

      if (resultado.deletedCount === 0) {
        throw new Error('Webhook nao encontrado');
      }

      logger.info(`[WebhookService] Webhook removido: ${webhookId}`);
      return true;
    } catch (error: unknown) {
      logger.error(`[WebhookService] Erro ao remover webhook: ${this.getErrorMessage(error)}`);
      throw error;
    }
  }

  async regenerarSecret(webhookId: string, empresaId: string): Promise<any> {
    try {
      const webhook = await Webhook.findOne({ _id: webhookId, empresa: empresaId });

      if (!webhook) {
        throw new Error('Webhook nao encontrado');
      }

      webhook.secret = crypto.randomBytes(32).toString('hex');
      await webhook.save();

      logger.info(`[WebhookService] Secret regenerado para webhook: ${webhook.nome}`);

      return {
        webhook_id: webhook._id,
        secret: webhook.secret,
        mensagem: 'Secret regenerado com sucesso. Guarde-o em local seguro, nao sera exibido novamente.',
      };
    } catch (error: unknown) {
      logger.error(`[WebhookService] Erro ao regenerar secret: ${this.getErrorMessage(error)}`);
      throw error;
    }
  }

  async testar(webhookId: string, empresaId: string): Promise<{ sucesso: boolean; mensagem: string }> {
    try {
      const webhook = await Webhook.findOne({ _id: webhookId, empresa: empresaId }).select('+secret');

      if (!webhook) {
        throw new Error('Webhook nao encontrado');
      }

      const payloadTeste = {
        mensagem: 'Este e um webhook de teste',
        teste: true,
        empresa_id: empresaId,
      };

      await this._dispararWebhook(webhook, 'teste', payloadTeste);

      return { sucesso: true, mensagem: 'Webhook de teste enviado' };
    } catch (error: unknown) {
      logger.error(`[WebhookService] Erro ao testar webhook: ${this.getErrorMessage(error)}`);
      throw error;
    }
  }
}

export default new WebhookService();
