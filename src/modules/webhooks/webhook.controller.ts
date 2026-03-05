/**
 * Webhook Controller
 * Endpoints para webhooks
 */
// src/modules/webhooks/webhook.controller.ts
import { Response, NextFunction } from 'express';
import { IAuthRequest } from '../../types/express';
import webhookService from './webhook.service';
import logger from '../../shared/container/logger';
import AppError from '../../shared/container/AppError';

function getRequiredUser(req: IAuthRequest): NonNullable<IAuthRequest['user']> {
    if (!req.user?.id || !req.user.empresaId) {
        throw new AppError('Usuário não autenticado', 401);
    }
    return req.user;
}

/**
 * Lista todos os webhooks da empresa
 */
export async function listarWebhooks(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const user = getRequiredUser(req);
        const empresaId = user.empresaId;
        const { ativo } = req.query;

        const filtros: Record<string, unknown> = {};
        if (ativo !== undefined) {
            filtros.ativo = ativo === 'true';
        }

        const webhooks = await webhookService.listar(empresaId, filtros);

        res.status(200).json({
            sucesso: true,
            total: webhooks.length,
            webhooks
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[WebhookController] Erro ao listar webhooks: ${msg}`);
        next(error);
    }
}

/**
 * Cria novo webhook
 */
export async function criarWebhook(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const user = getRequiredUser(req);
        const empresaId = user.empresaId;
        const userId = user.id;
        const { nome, url, eventos, retry_config, headers } = req.body;

        const webhook = await webhookService.criar({
            empresa: empresaId,
            nome,
            url,
            eventos,
            retry_config,
            headers
        }, userId);

        logger.info(`[WebhookController] Webhook criado por usuário ${userId}: ${webhook.nome}`);

        res.status(201).json({
            sucesso: true,
            mensagem: 'Webhook criado com sucesso',
            webhook
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[WebhookController] Erro ao criar webhook: ${msg}`);
        next(error);
    }
}

/**
 * Atualiza webhook existente
 */
export async function atualizarWebhook(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const user = getRequiredUser(req);
        const empresaId = user.empresaId;
        const { webhookId } = req.params;
        const dados = req.body;
        if (!webhookId) {
            throw new AppError('Webhook ID Ã© obrigatÃ³rio', 400);
        }

        const webhook = await webhookService.atualizar(webhookId, empresaId, dados);

        logger.info(`[WebhookController] Webhook atualizado: ${webhook.nome}`);

        res.status(200).json({
            sucesso: true,
            mensagem: 'Webhook atualizado com sucesso',
            webhook
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[WebhookController] Erro ao atualizar webhook: ${msg}`);
        next(error);
    }
}

/**
 * Remove webhook
 */
export async function removerWebhook(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const user = getRequiredUser(req);
        const empresaId = user.empresaId;
        const { webhookId } = req.params;
        if (!webhookId) {
            throw new AppError('Webhook ID Ã© obrigatÃ³rio', 400);
        }

        await webhookService.remover(webhookId, empresaId);

        logger.info(`[WebhookController] Webhook removido: ${webhookId}`);

        res.status(200).json({
            sucesso: true,
            mensagem: 'Webhook removido com sucesso'
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[WebhookController] Erro ao remover webhook: ${msg}`);
        next(error);
    }
}

/**
 * Regenera secret do webhook
 */
export async function regenerarSecret(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const user = getRequiredUser(req);
        const empresaId = user.empresaId;
        const { webhookId } = req.params;
        if (!webhookId) {
            throw new AppError('Webhook ID Ã© obrigatÃ³rio', 400);
        }

        const resultado = await webhookService.regenerarSecret(webhookId, empresaId);

        logger.info(`[WebhookController] Secret regenerado para webhook: ${webhookId}`);

        res.status(200).json({
            sucesso: true,
            ...resultado
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[WebhookController] Erro ao regenerar secret: ${msg}`);
        next(error);
    }
}

/**
 * Testa webhook
 */
export async function testarWebhook(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const user = getRequiredUser(req);
        const empresaId = user.empresaId;
        const { webhookId } = req.params;
        if (!webhookId) {
            throw new AppError('Webhook ID Ã© obrigatÃ³rio', 400);
        }

        await webhookService.testar(webhookId, empresaId);

        res.status(200).json({
            sucesso: true,
            mensagem: 'Webhook de teste enviado com sucesso'
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[WebhookController] Erro ao testar webhook: ${msg}`);
        next(error);
    }
}

/**
 * Busca detalhes de um webhook específico
 */
export async function buscarWebhook(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const user = getRequiredUser(req);
        const empresaId = user.empresaId;
        const { webhookId } = req.params;

        const webhooks = await webhookService.listar(empresaId, { _id: webhookId });

        if (webhooks.length === 0) {
            throw new AppError('Webhook não encontrado', 404);
        }

        res.status(200).json({
            sucesso: true,
            webhook: webhooks[0]
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[WebhookController] Erro ao buscar webhook: ${msg}`);
        next(error);
    }
}

export default {
    listarWebhooks,
    criarWebhook,
    atualizarWebhook,
    removerWebhook,
    regenerarSecret,
    testarWebhook,
    buscarWebhook
};

