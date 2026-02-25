/**
 * DEPRECADO: Use services/audit.service.ts
 * 
 * Mantido para compatibilidade com código legado.
 * Este arquivo será removido em versão futura.
 */

import { auditService } from './index';
import type { IAuditLog } from './AuditLog';

class AuditService {
  async log(
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    oldData?: any,
    newData?: any,
    ip?: string
  ): Promise<IAuditLog | null> {
    const result = await auditService.log({
      userId,
      action: action as any,
      resource,
      resourceId,
      oldData,
      newData,
      ip,
    });

    if (result.isFailure) {
      console.error('[AuditService Legacy] Erro ao criar log:', result.error.message);
      return null;
    }

    return result.value as any;
  }
}

export default new AuditService();