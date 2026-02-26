/**
 * Auth Controller - Legacy compatibility re-export
 * Re-exports the new auth controller for backward compatibility
 */

import { AuthRepository } from './repositories/auth.repository';
import { AuthService } from './services/auth.service';
import { AuthController as NewAuthController } from './controllers/auth.controller';
import User from '@modules/users/User';

// Dependency Injection
const repository = new AuthRepository(User);
const service = new AuthService(repository);
export const authController = new NewAuthController(service);

// Re-export for compatibility
export default authController;
export { AuthController } from './controllers/auth.controller';

