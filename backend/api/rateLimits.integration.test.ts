// ── Server integration tests ──────────────────────────────────────────────────

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client';

// Env stubs (safe to re-stub even if already set)
vi.stubEnv('BROWSERLESS_WS_URL', 'ws://browserless:3000/chromium/playwright');
vi.stubEnv('BROWSERLESS_TOKEN', 'test-token');
vi.stubEnv('API_KEY', 'supersecretapikey1234');
vi.stubEnv('CONFIG_PATH', '/tmp/test-config.yaml');
vi.stubEnv('ADMIN_USERNAME', 'admin');
vi.stubEnv('ADMIN_PASSWORD', 'password123');
vi.stubEnv('COOKIE_SECURE', 'false');

vi.mock('../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis() },
}));
vi.mock('../warmer/runner', () => ({
  runGroup: vi.fn().mockResolvedValue(1),
  startRunGroup: vi.fn().mockResolvedValue({ runId: 1, promise: Promise.resolve() }),
}));
vi.mock('../db/queries/sessions', () => ({
  createSession: vi.fn(), findActiveSession: vi.fn().mockResolvedValue(null),
  deleteSession: vi.fn(), touchSession: vi.fn(), deleteExpiredSessions: vi.fn(),
}));
vi.mock('../db/queries/runs', () => ({
  getRuns: vi.fn().mockResolvedValue([]), getRunById: vi.fn().mockResolvedValue(null),
  getLatestPerGroup: vi.fn().mockResolvedValue([]), finalizeRun: vi.fn(),
  deleteRuns: vi.fn().mockResolvedValue(0), renameGroup: vi.fn(),
}));
vi.mock('../db/queries/webhookTokens', () => ({
  listWebhookTokens: vi.fn().mockResolvedValue([]), createWebhookToken: vi.fn().mockResolvedValue({ id: 1, token: 'tok' }),
  deleteWebhookToken: vi.fn().mockResolvedValue(true), setWebhookTokenActive: vi.fn().mockResolvedValue(true),
  findWebhookToken: vi.fn().mockResolvedValue(null), touchWebhookToken: vi.fn(),
  renameGroupWebhookTokens: vi.fn(),
}));
vi.mock('../warmer/registry', () => ({ cancelRun: vi.fn().mockReturnValue(true) }));
vi.mock('../db/queries/visits', () => ({ getVisitsByRunId: vi.fn().mockResolvedValue([]) }));
vi.mock('../db/queries/visitScreenshot', () => ({
  getScreenshotsByRunId: vi.fn().mockResolvedValue([]), insertVisitScreenshot: vi.fn(),
}));
vi.mock('../db/queries/stats', () => ({
  getStats: vi.fn().mockResolvedValue({ statusCounts: {}, visitsByDay: [] }),
}));
vi.mock('node:fs', () => ({ writeFileSync: vi.fn() }));

const mockConfig = {
  groups: [{ name: 'test', schedule: '* * * * *', urls: ['https://example.com'], options: { scrollToBottom: false, crawl: false } }],
};
const API_KEY = 'supersecretapikey1234';

describe('Rate limiting — server integration', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const { buildServer } = await import('./server');
    app = await buildServer({ db: {} as unknown as Db, getConfig: () => mockConfig });
    await app.ready();
  });

  afterEach(async () => { await app.close(); });

  it('allows trigger requests under the limit', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/trigger/async',
      headers: { 'x-api-key': API_KEY, 'content-type': 'application/json' },
      payload: { group: 'test' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('returns 429 after exceeding trigger limit (10/min)', async () => {
    for (let i = 0; i < 10; i++) {
      await app.inject({
        method: 'POST', url: '/api/trigger/async',
        headers: { 'x-api-key': API_KEY, 'content-type': 'application/json' },
        payload: { group: 'test' },
      });
    }
    const res = await app.inject({
      method: 'POST', url: '/api/trigger/async',
      headers: { 'x-api-key': API_KEY, 'content-type': 'application/json' },
      payload: { group: 'test' },
    });
    expect(res.statusCode).toBe(429);
  });

  it('GET /api/rate-limits returns all three categories with correct maxes', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/rate-limits',
      headers: { 'x-api-key': API_KEY },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('read.max', 120);
    expect(body).toHaveProperty('write.max', 30);
    expect(body).toHaveProperty('trigger.max', 10);
  });

  it('rate limit stats reflect usage after requests', async () => {
    await app.inject({
      method: 'POST', url: '/api/trigger/async',
      headers: { 'x-api-key': API_KEY, 'content-type': 'application/json' },
      payload: { group: 'test' },
    });
    const res = await app.inject({
      method: 'GET', url: '/api/rate-limits',
      headers: { 'x-api-key': API_KEY },
    });
    expect(res.json().trigger.used).toBeGreaterThan(0);
  });
});
