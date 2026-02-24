/**
 * Audit Module Exports
 */

export * from './dtos/audit.dto';
export * from './repositories/audit.repository';
export * from './services/audit.service';
export * from './controllers/audit.controller';
export { default as auditRoutes } from './audit.routes';
export { default as AuditLog } from './AuditLog';

// Export singleton service para uso em outros módulos
import AuditLog from './AuditLog';
import { AuditRepository } from './repositories/audit.repository';
import { AuditService } from './services/audit.service';

const auditRepository = new AuditRepository(AuditLog);
export const auditService = new AuditService(auditRepository);
