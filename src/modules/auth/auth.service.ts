/**
 * DEPRECATED: Legacy compatibility file
 * This file re-exports the new auth service for backward compatibility.
 * All imports should be updated to use: import { AuthService } from '@modules/auth/services'
 */

// Re-export the new service for backward compatibility
export { AuthService } from './services/auth.service';
export * from './services/auth.service';
