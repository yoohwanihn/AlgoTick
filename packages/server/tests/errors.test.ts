import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/index';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  // Register crash route before first inject (inject triggers app.ready())
  app.get('/__crash__', async () => { throw new Error('boom'); });
});
afterAll(async () => { await app.close(); });

describe('global error handler', () => {
  it('returns standardized 404 for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/__no_such__' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 500 with code for unexpected errors', async () => {
    const res = await app.inject({ method: 'GET', url: '/__crash__' });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
