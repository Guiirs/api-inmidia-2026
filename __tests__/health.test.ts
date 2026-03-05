import request from 'supertest';
import app from '../src/shared/infra/http/app';

describe('Health endpoints', () => {
  it('GET /api/v1/status should return ok', async () => {
    const response = await request(app).get('/api/v1/status');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.environment).toBe('test');
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('GET /api/v1/health should return healthy', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(typeof response.body.uptime).toBe('number');
    expect(typeof response.body.timestamp).toBe('string');
  });
});
