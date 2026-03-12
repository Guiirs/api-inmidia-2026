import { findRoute, gatewayConfig } from '../src/gateway/gateway.config';

describe('Gateway config patterns', () => {
  it('should match singular and plural user routes', () => {
    const singular = findRoute('/api/v1/user/me');
    const plural = findRoute('/api/v1/users/me');
    expect(singular).toBeDefined();
    expect(plural).toBeDefined();
    expect(singular?.module).toBe('users');
    expect(plural?.module).toBe('users');
  });

  it('should include sse route in configuration', () => {
    const sse = gatewayConfig.routes.find(r => r.path.includes('/sse'));
    expect(sse).toBeDefined();
    expect(sse?.requiresAuth).toBe(true);
  });
});
