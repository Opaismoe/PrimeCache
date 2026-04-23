import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';

vi.stubEnv('BROWSERLESS_WS_URL', 'ws://browserless:3000/chromium/playwright');
vi.stubEnv('BROWSERLESS_TOKEN', 'test-token');
vi.stubEnv('API_KEY', 'supersecretapikey1234');
vi.stubEnv('CONFIG_PATH', '/tmp/test-config.yaml');
vi.stubEnv('ADMIN_USERNAME', 'admin');
vi.stubEnv('ADMIN_PASSWORD', 'password123');
vi.stubEnv('COOKIE_SECURE', 'false');

vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

vi.mock('node:fs', () => ({ writeFileSync: vi.fn() }));
vi.mock('../warmer/runner', () => ({
  runGroup: vi.fn(),
  startRunGroup: vi.fn(),
}));
vi.mock('../scheduler/index', () => ({ registerJobs: vi.fn(), registerSessionSweep: vi.fn() }));
vi.mock('../warmer/registry', () => ({ cancelRun: vi.fn() }));
vi.mock('../db/queries/runs', () => ({
  getRuns: vi.fn().mockResolvedValue([]),
  getRunById: vi.fn().mockResolvedValue(null),
  getLatestPerGroup: vi.fn().mockResolvedValue([]),
  finalizeRun: vi.fn().mockResolvedValue(undefined),
  deleteRuns: vi.fn().mockResolvedValue(0),
  renameGroup: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../db/queries/webhookTokens', () => ({
  listWebhookTokens: vi.fn().mockResolvedValue([]),
  createWebhookToken: vi.fn().mockResolvedValue({}),
  deleteWebhookToken: vi.fn().mockResolvedValue(true),
  setWebhookTokenActive: vi.fn().mockResolvedValue(true),
  findWebhookToken: vi.fn().mockResolvedValue(null),
  touchWebhookToken: vi.fn().mockResolvedValue(undefined),
  renameGroupWebhookTokens: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../db/queries/visits', () => ({ getVisitsByRunId: vi.fn().mockResolvedValue([]) }));
vi.mock('../db/queries/visitScreenshot', () => ({
  getScreenshotsByRunId: vi.fn().mockResolvedValue([]),
  insertVisitScreenshot: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../db/queries/stats', () => ({
  getStats: vi.fn().mockResolvedValue({ statusCounts: {}, visitsByDay: [] }),
}));

type PGliteDb = ReturnType<typeof drizzle<typeof schema>>;

async function createTestDb(): Promise<PGliteDb> {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.join(__dirname, '..', 'db', 'migrations') });
  return db;
}

let app: FastifyInstance;
let db: PGliteDb;

const mockConfig = { groups: [] };

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  db = await createTestDb();
  const { buildServer } = await import('./server');
  app = await buildServer({
    db: db as unknown as import('../db/client').Db,
    getConfig: () => mockConfig as unknown as import('../config/urls').Config,
  });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

function parseCookies(header: string | string[] | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  const headers = Array.isArray(header) ? header : header ? [header] : [];
  for (const h of headers) {
    const [pair] = h.split(';');
    const [name, ...rest] = pair.split('=');
    if (name) cookies[name.trim()] = rest.join('=').trim();
  }
  return cookies;
}

// ── Login ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('returns 200 and sets session cookie on valid credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);

    const cookies = parseCookies(res.headers['set-cookie']);
    expect(cookies.pc_session).toBeDefined();
    expect(cookies.pc_session.length).toBeGreaterThan(10);
    expect(cookies.pc_csrf).toBeDefined();
  });

  it('does not return the API_KEY in the login response', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).not.toHaveProperty('token');
    expect(JSON.stringify(res.json())).not.toContain('supersecretapikey1234');
  });

  it('returns 401 for wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when fields are missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin' }),
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── /api/auth/me ──────────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('returns 401 with no auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with valid session cookie', async () => {
    // Login first to get a session cookie
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' }),
    });
    const cookies = parseCookies(login.headers['set-cookie']);

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: `pc_session=${cookies.pc_session}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('returns 200 with X-API-Key (machine path)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { 'x-api-key': 'supersecretapikey1234' },
    });
    expect(res.statusCode).toBe(200);
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('clears session cookie and invalidates session', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' }),
    });
    const cookies = parseCookies(login.headers['set-cookie']);

    // Logout
    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        cookie: `pc_session=${cookies.pc_session}; pc_csrf=${cookies.pc_csrf}`,
        'x-csrf-token': cookies.pc_csrf,
      },
    });
    expect(logout.statusCode).toBe(200);

    // Session should be invalidated now
    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: `pc_session=${cookies.pc_session}` },
    });
    expect(me.statusCode).toBe(401);
  });
});

// ── CSRF protection ───────────────────────────────────────────────────────────

describe('CSRF protection on cookie-auth non-GET routes', () => {
  it('returns 403 on POST with cookie auth but missing X-CSRF-Token', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' }),
    });
    const cookies = parseCookies(login.headers['set-cookie']);

    // POST without CSRF header — should be rejected
    const res = await app.inject({
      method: 'POST',
      url: '/api/trigger',
      headers: {
        'content-type': 'application/json',
        cookie: `pc_session=${cookies.pc_session}; pc_csrf=${cookies.pc_csrf}`,
        // no x-csrf-token
      },
      body: JSON.stringify({ group: 'homepage' }),
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 403 on POST with cookie auth and wrong X-CSRF-Token', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' }),
    });
    const cookies = parseCookies(login.headers['set-cookie']);

    const res = await app.inject({
      method: 'POST',
      url: '/api/trigger',
      headers: {
        'content-type': 'application/json',
        cookie: `pc_session=${cookies.pc_session}; pc_csrf=${cookies.pc_csrf}`,
        'x-csrf-token': 'wrong-csrf-token',
      },
      body: JSON.stringify({ group: 'homepage' }),
    });
    expect(res.statusCode).toBe(403);
  });

  it('X-API-Key auth bypasses CSRF check on POST', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/trigger',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'supersecretapikey1234',
        // no CSRF headers at all
      },
      body: JSON.stringify({ group: 'nonexistent' }),
    });
    // 400 (unknown group) not 403 (CSRF fail) — proves CSRF was not enforced
    expect(res.statusCode).toBe(400);
  });
});

// ── Existing X-API-Key paths still work (regression) ────────────────────────

describe('X-API-Key regression — existing machine path', () => {
  it('GET /api/runs still works with X-API-Key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/runs',
      headers: { 'x-api-key': 'supersecretapikey1234' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/config still works with X-API-Key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/config',
      headers: { 'x-api-key': 'supersecretapikey1234' },
    });
    expect(res.statusCode).toBe(200);
  });
});
