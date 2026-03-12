/**
 * Queue Controller
 * Gerenciamento de filas
 */
// src/modules/system/queue/queue.controller.ts
import fs from 'fs/promises';
import { Response, NextFunction } from 'express';
import { IAuthRequest } from '../../../types/express';
import QueueService from '../../../shared/container/queue.service';
import PiGenJob from '../../../models/PiGenJob';
import logger from '../../../shared/container/logger';
import AppError from '../../../shared/container/AppError';
import { auditService } from '@modules/audit';

const queueService = QueueService;

function applySecureDownloadHeaders(res: Response): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Download-Options', 'noopen');
}

function logDownloadAudit(userId: string, jobId: string, req: IAuthRequest): void {
  void auditService
    .log({
      userId,
      action: 'READ',
      resource: 'queue-job',
      resourceId: jobId,
      ip: req.ip,
    })
    .catch((error) => {
      logger.error(
        `[QueueController] Falha ao registrar auditoria download job/${jobId}: ${
          (error as any)?.message || 'erro desconhecido'
        }`
      );
    });
}

/**
 * Inicia geracao de PDF de Contrato via Queue
 */
export async function generateContratoPDF(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
  const empresaId = (req.user as any).empresaId;
  const userId = (req.user as any).id;
  const { id: contratoId } = req.params;
  const { options } = req.body || {};
  if (!contratoId) {
    next(new AppError('ID do contrato ÃƒÂ© obrigatÃƒÂ³rio.', 400));
    return;
  }

  logger.info(
    `[QueueController] generateContratoPDF requisitado para contrato ${contratoId} por user ${userId} (Empresa ${empresaId}).`
  );

  try {
    const jobId = await queueService.addPDFJob(contratoId, empresaId, req.user, {
      type: 'contrato',
      ...options,
    });

    res.status(202).json({
      success: true,
      jobId,
      message: 'PDF generation started. Check status with /api/v1/queue/jobs/{jobId}',
      statusUrl: `/api/v1/queue/jobs/${jobId}`,
    });
  } catch (err: any) {
    logger.error(`[QueueController] Error starting contrato PDF generation: ${err.message}`);
    next(err);
  }
}

/**
 * Inicia geracao de PDF de PI via Queue
 */
export async function generatePIPDF(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
  const empresaId = (req.user as any).empresaId;
  const userId = (req.user as any).id;
  const { id: piId } = req.params;
  const { options } = req.body || {};
  if (!piId) {
    next(new AppError('ID da PI ÃƒÂ© obrigatÃƒÂ³rio.', 400));
    return;
  }

  logger.info(
    `[QueueController] generatePIPDF requisitado para PI ${piId} por user ${userId} (Empresa ${empresaId}).`
  );

  try {
    const jobId = await queueService.addPDFJob(piId, empresaId, req.user, {
      type: 'pi',
      ...options,
    });

    res.status(202).json({
      success: true,
      jobId,
      message: 'PDF generation started. Check status with /api/v1/queue/jobs/{jobId}',
      statusUrl: `/api/v1/queue/jobs/${jobId}`,
    });
  } catch (err: any) {
    logger.error(`[QueueController] Error starting PI PDF generation: ${err.message}`);
    next(err);
  }
}

/**
 * Busca status de um job especifico
 */
export async function getJobStatus(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
  const empresaId = (req.user as any).empresaId;
  const { jobId } = req.params;
  if (!jobId) {
    next(new AppError('Job ID ÃƒÂ© obrigatÃƒÂ³rio.', 400));
    return;
  }

  logger.info(`[QueueController] getJobStatus requisitado para job ${jobId} por empresa ${empresaId}.`);

  try {
    const job = await PiGenJob.findOne({ jobId, empresaId }).lean();

    if (!job) {
      res.status(404).json({
        success: false,
        error: 'Job not found',
      });
      return;
    }
    const jobData = job as any;

    res.status(200).json({
      success: true,
      job: {
        jobId: jobData.jobId,
        status: jobData.status,
        progress: jobData.progress || 0,
        resultPath: jobData.resultPath,
        resultUrl: jobData.resultUrl,
        error: jobData.error,
        createdAt: jobData.createdAt,
        updatedAt: jobData.updatedAt,
        whatsappSent: jobData.whatsappSent,
        whatsappSentAt: jobData.whatsappSentAt,
      },
    });
  } catch (err: any) {
    logger.error(`[QueueController] Error getting job status: ${err.message}`);
    next(err);
  }
}

/**
 * Lista jobs de uma empresa (com paginacao)
 */
export async function getJobs(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
  const empresaId = (req.user as any).empresaId;
  const { page = 1, limit = 10, status } = req.query;

  logger.info(`[QueueController] getJobs requisitado por empresa ${empresaId}.`);

  try {
    const query: any = { empresaId };
    if (status) {
      query.status = status;
    }

    const jobs = await PiGenJob.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      .lean();

    const total = await PiGenJob.countDocuments(query);

    res.status(200).json({
      success: true,
      data: jobs.map((job: any) => ({
        jobId: job.jobId,
        status: job.status,
        progress: job.progress || 0,
        resultPath: job.resultPath,
        resultUrl: job.resultUrl,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        whatsappSent: job.whatsappSent,
        whatsappSentAt: job.whatsappSentAt,
      })),
      pagination: {
        currentPage: parseInt(page as string),
        totalPages: Math.ceil(total / parseInt(limit as string)),
        totalItems: total,
        itemsPerPage: parseInt(limit as string),
      },
    });
  } catch (err: any) {
    logger.error(`[QueueController] Error getting jobs: ${err.message}`);
    next(err);
  }
}

/**
 * Download do arquivo gerado (fallback para quando o job esta completo)
 */
export async function downloadJobResult(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
  const empresaId = (req.user as any).empresaId;
  const userId = (req.user as any).id;
  const { jobId } = req.params;
  if (!jobId) {
    next(new AppError('Job ID ÃƒÂ© obrigatÃƒÂ³rio.', 400));
    return;
  }
  if (!userId) {
    next(new AppError('Usuario nao autenticado.', 401));
    return;
  }

  logger.info(`[QueueController] downloadJobResult requisitado para job ${jobId} por user ${userId} (Empresa ${empresaId}).`);

  try {
    const job = await PiGenJob.findOne({ jobId, empresaId });

    if (!job) {
      res.status(404).json({
        success: false,
        error: 'Job not found',
      });
      return;
    }

    if (job.status !== 'done') {
      res.status(400).json({
        success: false,
        error: 'Job is not completed yet',
        status: job.status,
      });
      return;
    }

    if (!job.resultPath) {
      res.status(404).json({
        success: false,
        error: 'Result file not found',
      });
      return;
    }

    const filePath = job.resultPath.trim();
    if (!filePath.endsWith('.pdf')) {
      res.status(400).json({
        success: false,
        error: 'Invalid file type for download',
      });
      return;
    }

    try {
      await fs.access(filePath);
    } catch (error: any) {
      logger.error(`[QueueController] Arquivo indisponível para download (${filePath}): ${error?.message}`);
      res.status(404).json({
        success: false,
        error: 'Result file not found',
      });
      return;
    }

    applySecureDownloadHeaders(res);
    logDownloadAudit(userId, jobId, req);

    res.download(filePath, `document-${jobId}.pdf`, (err) => {
      if (err) {
        logger.error(`[QueueController] Error downloading file: ${err.message}`);
        // Don't call next() here as headers might already be sent
      }
    });
  } catch (err: any) {
    logger.error(`[QueueController] Error downloading job result: ${err.message}`);
    next(err);
  }
}

export default {
  generateContratoPDF,
  generatePIPDF,
  getJobStatus,
  getJobs,
  downloadJobResult,
};
