import { Request, Response, NextFunction } from 'express';
import { auditService } from '@modules/audit';
import logger from '@shared/container/logger';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' | 'LOGIN' | 'LOGOUT';

export const auditMiddleware = (action: AuditAction, resource: string) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      if (userId) {
        const resourceId = req.params.id || req.body.id || 'unknown';
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        await auditService.log({
          userId,
          action,
          resource,
          resourceId,
          newData: req.body,
          ip,
        });
      }
    } catch (error) {
      logger.error(`[AuditMiddleware] Logging failed: ${error}`);
    }
    next();
  };
};