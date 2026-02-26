/**
 * DEPRECATED: Legacy compatibility file
 * This file re-exports the new audit service for backward compatibility.
 * All imports should be updated to use: import { auditService } from '@modules/audit'
 */

// Re-export the new service as default for backward compatibility
export { auditService as default } from './index';
export * from './index';