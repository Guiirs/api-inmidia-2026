import { Result } from '@shared/core/Result';
import { DomainError, NotFoundError, ValidationError } from '@shared/core/DomainError';
import axios from 'axios';
import {
  SendMessageInput,
  SendBulkMessagesInput,
  CreateTemplateInput,
  UpdateTemplateInput,
  ListTemplatesQuery,
  MessageEntity,
  TemplateEntity,
  PaginatedTemplatesResponse,
  BulkSendResult
} from '../dtos/whatsapp.dto';

// Mock models - Replace with actual imports
const WhatsAppMessage = {
  create(data: any) {
    return {
      save: async () => ({ _id: '123', ...data })
    };
  },
  async findById(_id: string) {
    return null;
  }
};

const WhatsAppTemplate = {
  async findOne(_query: any) {
    return null;
  },
  async find(_query: any) {
    return { lean: () => [] };
  },
  async countDocuments(_query: any) {
    return 0;
  },
  async findById(_id: string) {
    return null;
  },
  async findByIdAndUpdate(_id: string, _data: any, _options: any) {
    return null;
  },
  async findByIdAndDelete(_id: string) {
    return null;
  },
  create(data: any) {
    return {
      save: async () => ({ _id: '123', ...data })
    };
  }
};

/**
 * Repository para WhatsApp
 */
export class WhatsAppRepository {
  private getWhatsAppConfig() {
    return {
      apiUrl: process.env.WHATSAPP_API_URL || '',
      token: process.env.WHATSAPP_API_TOKEN || '',
      timeoutMs: parseInt(process.env.WHATSAPP_API_TIMEOUT_MS || '10000', 10),
    };
  }

  /**
   * Enviar mensagem
   */
  async sendMessage(data: SendMessageInput): Promise<Result<MessageEntity, DomainError>> {
    try {
      let status: MessageEntity['status'] = 'sent';
      const cfg = this.getWhatsAppConfig();

      if (cfg.apiUrl) {
        const response = await axios.post(
          cfg.apiUrl,
          {
            to: data.to,
            message: data.message,
          },
          {
            timeout: cfg.timeoutMs,
            validateStatus: () => true,
            headers: {
              'Content-Type': 'application/json',
              ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
            },
          }
        );

        status = response.status >= 200 && response.status < 300 ? 'sent' : 'failed';
      }

      const message = WhatsAppMessage.create({
        to: data.to,
        message: data.message,
        status,
        sentAt: new Date()
      });

      const saved = await message.save();

      return Result.ok({
        _id: saved._id,
        to: saved.to,
        message: saved.message,
        status: saved.status,
        sentAt: saved.sentAt
      });
    } catch (error) {
      return Result.fail(
        new ValidationError([{
          field: 'geral',
          message: 'Erro ao enviar mensagem'
        }])
      );
    }
  }

  /**
   * Enviar mensagens em lote
   */
  async sendBulkMessages(data: SendBulkMessagesInput): Promise<Result<BulkSendResult, DomainError>> {
    try {
      const results: MessageEntity[] = [];
      const errors: Array<{ recipient: string; error: string }> = [];

      for (const recipient of data.recipients) {
        const messageResult = await this.sendMessage({
          to: recipient.to,
          message: recipient.message
        });

        if (messageResult.isSuccess) {
          results.push(messageResult.value);
        } else {
          errors.push({
            recipient: recipient.to,
            error: messageResult.error.message
          });
        }
      }

      return Result.ok({
        total: data.recipients.length,
        sent: results.length,
        failed: errors.length,
        results: [
          ...results.map(m => ({
            to: m.to,
            success: true,
            messageId: m._id?.toString()
          })),
          ...errors.map(e => ({
            to: e.recipient,
            success: false,
            error: e.error
          }))
        ],
        messages: results,
        errors
      });
    } catch (error) {
      return Result.fail(
        new ValidationError([{
          field: 'geral',
          message: 'Erro ao enviar mensagens em lote'
        }])
      );
    }
  }

  /**
   * Buscar status de mensagem
   */
  async getMessageStatus(id: string): Promise<Result<MessageEntity, DomainError>> {
    try {
      const message = await WhatsAppMessage.findById(id);

      if (!message) {
        return Result.fail(new NotFoundError('Mensagem', id));
      }

      return Result.ok({
        _id: (message as any)._id,
        to: (message as any).to,
        message: (message as any).message,
        templateId: (message as any).templateId,
        status: (message as any).status,
        sentAt: (message as any).sentAt
      });
    } catch (error) {
      return Result.fail(
        new ValidationError([{
          field: 'geral',
          message: 'Erro ao buscar status da mensagem'
        }])
      );
    }
  }

  /**
   * Criar template
   */
  async createTemplate(data: CreateTemplateInput): Promise<Result<TemplateEntity, DomainError>> {
    try {
      // Verificar se já existe template com mesmo nome
      const existing = await WhatsAppTemplate.findOne({ name: data.name });
      if (existing) {
        return Result.fail(
          new ValidationError([{
            field: 'name',
            message: 'Já existe um template com este nome'
          }])
        );
      }

      const template = WhatsAppTemplate.create({
        name: data.name,
        content: data.message,
        variables: data.variables || [],
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const saved = await template.save();

      return Result.ok({
        _id: saved._id,
        name: saved.name,
        content: saved.content,
        variables: saved.variables,
        active: saved.active,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt
      });
    } catch (error) {
      return Result.fail(
        new ValidationError([{
          field: 'geral',
          message: 'Erro ao criar template'
        }])
      );
    }
  }

  /**
   * Buscar template por ID
   */
  async findTemplateById(id: string): Promise<Result<TemplateEntity | null, DomainError>> {
    try {
      const template = await WhatsAppTemplate.findById(id);

      if (!template) {
        return Result.ok(null);
      }

      return Result.ok({
        _id: (template as any)._id,
        name: (template as any).name,
        content: (template as any).content,
        variables: (template as any).variables,
        active: (template as any).active,
        createdAt: (template as any).createdAt,
        updatedAt: (template as any).updatedAt
      });
    } catch (error) {
      return Result.fail(
        new ValidationError([{
          field: 'geral',
          message: 'Erro ao buscar template'
        }])
      );
    }
  }

  /**
   * Listar templates
   */
  async listTemplates(query: ListTemplatesQuery): Promise<Result<PaginatedTemplatesResponse, DomainError>> {
    try {
      const { page = 1, limit = 10, active } = query;

      const filter: any = {};
      if (active !== undefined) {
        filter.active = active;
      }

      const templates = await (await WhatsAppTemplate.find(filter)).lean();
      const total = await WhatsAppTemplate.countDocuments(filter);

      const data: TemplateEntity[] = (templates as any[]).map((t: any) => ({
        _id: t._id,
        name: t.name,
        content: t.content,
        variables: t.variables,
        active: t.active,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      }));

      return Result.ok({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      return Result.fail(
        new ValidationError([{
          field: 'geral',
          message: 'Erro ao listar templates'
        }])
      );
    }
  }

  /**
   * Atualizar template
   */
  async updateTemplate(id: string, data: UpdateTemplateInput): Promise<Result<TemplateEntity, DomainError>> {
    try {
      const template = await WhatsAppTemplate.findByIdAndUpdate(
        id,
        {
          ...data,
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      );

      if (!template) {
        return Result.fail(new NotFoundError('Template', id));
      }

      return Result.ok({
        _id: (template as any)._id,
        name: (template as any).name,
        content: (template as any).content,
        variables: (template as any).variables,
        active: (template as any).active,
        createdAt: (template as any).createdAt,
        updatedAt: (template as any).updatedAt
      });
    } catch (error) {
      return Result.fail(
        new ValidationError([{
          field: 'geral',
          message: 'Erro ao atualizar template'
        }])
      );
    }
  }

  /**
   * Deletar template
   */
  async deleteTemplate(id: string): Promise<Result<void, DomainError>> {
    try {
      const template = await WhatsAppTemplate.findByIdAndDelete(id);

      if (!template) {
        return Result.fail(new NotFoundError('Template', id));
      }

      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(
        new ValidationError([{
          field: 'geral',
          message: 'Erro ao deletar template'
        }])
      );
    }
  }
}
