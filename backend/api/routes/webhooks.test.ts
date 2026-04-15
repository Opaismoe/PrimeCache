import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../db/client';

vi.stubEnv('BROWSERLESS_WS_URL', 'ws://browserless:3000/chromium/playwright');
vi.stubEnv('BROWSERLESS_TOKEN', 'test-token');
vi.stubEnv('API_KEY', 'supersecretapikey1234');
vi.stubEnv('CONFIG_PATH', '/tmp/test-config.yaml');
vi.stubEnv('ADMIN_USERNAME', 'admin');
vi.stubEnv('ADMIN_PASSWORD', 'password123');
vi.stubEnv('SECRET_ENCRYPTION_KEY', 'a'.repeat(64));

vi.mock('../../warmer/runner', () => ({
  runGroup: vi.fn().mockResolvedValue(42),
  startRunGroup: vi.fn().mockResolvedValue({ runId: 42, promise: Promise.resolve() }),
}));
vi.mock('../../scheduler/index', () => ({ registerJobs: vi.fn() }));
vi.mock('../../db/queries/runs', () => ({
  getRuns: vi.fn().mockResolvedValue([]),
  getRunById: vi.fn().mockResolvedValue(null),
  getLatestPerGroup: vi.fn().mockResolvedValue([]),
  finalizeRun: vi.fn().mockResolvedValue(undefined),
  deleteRuns: vi.fn().mockResolvedValue(0),
  renameGroup: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../warmer/registry', () => ({ cancelRun: vi.fn() }));
vi.mock('../../db/queries/visits', () => ({ getVisitsByRunId: vi.fn().mockResolvedValue([]) }));
vi.mock('../../db/queries/stats', () => ({
  getStats: vi.fn().mockResolvedValue({ statusCounts: {}, visitsByDay: [] }),
}));
vi.mock('node:fs', () => ({ writeFileSync: vi.fn() }));

const mockToken = {
  id: 1,
  group_name: 'homepage',
  token: 'abc123token',
  description: 'Contentful prod',
  active: true,
  created_at: new Date('2026-01-01'),
  last_used_at: null,
};

const { token: _token, ...mockTokenPublic } = mockToken;

vi.mock('../../db/queries/webhookTokens', () => ({
  listWebhookTokens: vi.fn().mockResolvedValue([mockTokenPublic]),
  createWebhookToken: vi.fn().mockResolvedValue(mockToken),
  deleteWebhookToken: vi.fn().mockResolvedValue(true),
  setWebhookTokenActive: vi.fn().mockResolvedValue(true),
  findWebhookToken: vi.fn().mockResolvedValue(null),
  touchWebhookToken: vi.fn().mockResolvedValue(undefined),
  renameGroupWebhookTokens: vi.fn().mockResolvedValue(undefined),
}));

const mockConfig = {
  groups: [
    {
      name: 'homepage',
      schedule: '*/15 * * * *',
      urls: ['https://example.com/'],
      options: { scrollToBottom: false, crawl: false },
    },
  ],
} as unknown as import('../../config/urls').Config;

const API_KEY = 'supersecretapikey1234';

let app: FastifyInstance;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  const { buildServer } = await import('../server');
  app = await buildServer({ db: {} as unknown as Db, getConfig: () => mockConfig });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// ── GET /api/groups/:name/webhooks ────────────────────────────────────────────

describe('GET /api/groups/:name/webhooks', () => {
  it('returns 401 without API key', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/groups/homepage/webhooks' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 for unknown group', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/groups/unknown/webhooks',
      headers: { 'x-api-key': API_KEY },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns token list without token values', async () => {
    const { listWebhookTokens } = await import('../../db/queries/webhookTokens');
    const res = await app.inject({
      method: 'GET',
      url: '/api/groups/homepage/webhooks',
      headers: { 'x-api-key': API_KEY },
    });
    expect(res.statusCode).toBe(200);
    expect(vi.mocked(listWebhookTokens)).toHaveBeenCalledWith(expect.anything(), 'homepage');
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    // token value must never appear in list response
    expect(body[0]).not.toHaveProperty('token');
  });
});

// ── POST /api/groups/:name/webhooks ───────────────────────────────────────────

describe('POST /api/groups/:name/webhooks', () => {
  it('returns 401 without API key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/groups/homepage/webhooks',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 for unknown group', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/groups/unknown/webhooks',
      headers: { 'x-api-key': API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ description: 'test' }),
    });
    expect(res.statusCode).toBe(404);
  });

  it('creates and returns a token (including token value)', async () => {
    const { createWebhookToken } = await import('../../db/queries/webhookTokens');
    const res = await app.inject({
      method: 'POST',
      url: '/api/groups/homepage/webhooks',
      headers: { 'x-api-key': API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ description: 'Contentful prod' }),
    });
    expect(res.statusCode).toBe(200);
    expect(vi.mocked(createWebhookToken)).toHaveBeenCalledWith(expect.anything(), {
      groupName: 'homepage',
      description: 'Contentful prod',
    });
    const body = res.json();
    expect(body).toHaveProperty('token');
    expect(body).toHaveProperty('id');
  });

  it('creates token without description', async () => {
    const { createWebhookToken } = await import('../../db/queries/webhookTokens');
    const res = await app.inject({
      method: 'POST',
      url: '/api/groups/homepage/webhooks',
      headers: { 'x-api-key': API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.statusCode).toBe(200);
    expect(vi.mocked(createWebhookToken)).toHaveBeenCalledWith(expect.anything(), {
      groupName: 'homepage',
      description: undefined,
    });
  });
});

// ── DELETE /api/groups/:name/webhooks/:id ─────────────────────────────────────

describe('DELETE /api/groups/:name/webhooks/:id', () => {
  it('returns 401 without API key', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/groups/homepage/webhooks/1' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 when token does not exist', async () => {
    const { deleteWebhookToken } = await import('../../db/queries/webhookTokens');
    vi.mocked(deleteWebhookToken).mockResolvedValueOnce(false);
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/groups/homepage/webhooks/99',
      headers: { 'x-api-key': API_KEY },
    });
    expect(res.statusCode).toBe(404);
  });

  it('deletes existing token and returns { deleted: true }', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/groups/homepage/webhooks/1',
      headers: { 'x-api-key': API_KEY },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().deleted).toBe(true);
  });
});

// ── PATCH /api/groups/:name/webhooks/:id ──────────────────────────────────────

describe('PATCH /api/groups/:name/webhooks/:id', () => {
  it('returns 401 without API key', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/groups/homepage/webhooks/1',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: false }),
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when active is not a boolean', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/groups/homepage/webhooks/1',
      headers: { 'x-api-key': API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ active: 'yes' }),
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when token does not exist', async () => {
    const { setWebhookTokenActive } = await import('../../db/queries/webhookTokens');
    vi.mocked(setWebhookTokenActive).mockResolvedValueOnce(false);
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/groups/homepage/webhooks/99',
      headers: { 'x-api-key': API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ active: false }),
    });
    expect(res.statusCode).toBe(404);
  });

  it('toggles active and returns updated state', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/groups/homepage/webhooks/1',
      headers: { 'x-api-key': API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ active: false }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: 1, active: false });
  });
});

// ── POST /webhook/trigger/:token ──────────────────────────────────────────────

describe('POST /webhook/trigger/:token', () => {
  it('returns 404 for unknown token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/trigger/unknowntoken',
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for inactive token', async () => {
    const { findWebhookToken } = await import('../../db/queries/webhookTokens');
    vi.mocked(findWebhookToken).mockResolvedValueOnce({ ...mockToken, active: false });
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/trigger/abc123token',
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when group no longer exists in config', async () => {
    const { findWebhookToken } = await import('../../db/queries/webhookTokens');
    vi.mocked(findWebhookToken).mockResolvedValueOnce({
      ...mockToken,
      group_name: 'deleted-group',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/trigger/abc123token',
    });
    expect(res.statusCode).toBe(404);
  });

  it('fires a run and returns { queued: true, runId }', async () => {
    const { findWebhookToken } = await import('../../db/queries/webhookTokens');
    vi.mocked(findWebhookToken).mockResolvedValueOnce(mockToken);
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/trigger/abc123token',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().queued).toBe(true);
    expect(typeof res.json().runId).toBe('number');
  });

  it('does not require X-API-Key header', async () => {
    const { findWebhookToken } = await import('../../db/queries/webhookTokens');
    vi.mocked(findWebhookToken).mockResolvedValueOnce(mockToken);
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/trigger/abc123token',
      // no x-api-key header
    });
    expect(res.statusCode).toBe(200);
  });
});
