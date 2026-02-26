/**
 * Checking Controller - Legacy compatibility re-export
 * Re-exports the new checking controller for backward compatibility
 */

import Checking from './Checking';
import { CheckingRepository } from './repositories/checking.repository';
import { CheckingService } from './services/checking.service';
import { CheckingController as NewCheckingController } from './controllers/checking.controller';

// Dependency Injection
const repository = new CheckingRepository(Checking);
const service = new CheckingService(repository);
export const checkingController = new NewCheckingController(service);

// Re-export for compatibility
export default checkingController;
export { CheckingController } from './controllers/checking.controller';