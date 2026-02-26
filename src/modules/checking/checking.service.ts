/**
 * DEPRECATED: Legacy compatibility file
 * This file re-exports the new checking service for backward compatibility.
 * All imports should be updated to use: import { CheckingService } from '@modules/checking/services'
 */

// Re-export the new service for backward compatibility
export { CheckingService } from './services/checking.service';
export * from './services/checking.service';