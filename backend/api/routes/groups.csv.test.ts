import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../db/client';
import { csvCell } from './groups';

// ── Environment stubs (required by server imports) ────────────────────────────

vi.stubEnv('BROWSERLESS_WS_URL', 'ws://browserless:3000/chromium/playwright');
vi.stubEnv('BROWSERLESS_TOKEN', 'test-token');
vi.stubEnv('API_KEY', 'supersecretapikey1234');
vi.stubEnv('CONFIG_PATH', '/tmp/test-config.yaml');
vi.stubEnv('ADMIN_USERNAME', 'admin');
vi.stubEnv('ADMIN_PASSWORD', 'password123');

vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

vi.mock('../../db/queries/groupSeo', () => ({
  getGroupSeo: vi.fn().mockResolvedValue({ urls: [] }),
}));

vi.mock('node:fs', () => ({ writeFileSync: vi.fn() }));

// ── csvCell unit tests ────────────────────────────────────────────────────────

describe('csvCell', () => {
  it('returns empty quoted string for null', () => {
    expect(csvCell(null)).toBe('""');
  });

  it('returns empty quoted string for undefined', () => {
    expect(csvCell(undefined)).toBe('""');
  });

  it('wraps plain values in double quotes', () => {
    expect(csvCell('hello')).toBe('"hello"');
    expect(csvCell('https://example.com/')).toBe('"https://example.com/"');
  });

  it('prepends a single-quote guard for = prefixed values (formula injection)', () => {
    expect(csvCell('=SUM(1,2)')).toBe('"\'=SUM(1,2)"');
  });

  it('prepends a single-quote guard for + prefixed values', () => {
    expect(csvCell('+1')).toBe('"\'+1"');
  });

  it('prepends a single-quote guard for - prefixed values', () => {
    expect(csvCell('-text')).toBe('"\'-text"');
  });

  it('prepends a single-quote guard for @ prefixed values', () => {
    expect(csvCell('@user')).toBe('"\'@user"');
  });

  it('doubles embedded double quotes', () => {
    expect(csvCell('say "hello"')).toBe('"say ""hello"""');
  });

  it('doubles quotes AND guards formula trigger in the same value', () => {
    expect(csvCell('=cmd"arg"')).toBe('"\'=cmd""arg"""');
  });
});

// ── Content-Disposition filename sanitization ─────────────────────────────────

let app: FastifyInstance;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  const { buildServer } = await import('../server');
  app = await buildServer({ db: {} as unknown as Db, getConfig: () => ({ groups: [] }) });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('GET /groups/:name/export Content-Disposition', () => {
  it('sanitizes special chars from the ASCII filename part', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/groups/${encodeURIComponent('evil";filename="x.html')}/export?tab=seo`,
      headers: { 'x-api-key': 'supersecretapikey1234' },
    });

    expect(res.statusCode).toBe(200);
    const disposition = res.headers['content-disposition'] as string;

    // ASCII filename must not contain the raw quotes or semicolon
    expect(disposition).not.toMatch(/";filename=/);
    // Should contain the sanitized form
    expect(disposition).toContain('attachment; filename="');
  });

  it('includes RFC 5987 filename* with percent-encoding for unicode group names', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/groups/${encodeURIComponent('my group')}/export?tab=seo`,
      headers: { 'x-api-key': 'supersecretapikey1234' },
    });

    expect(res.statusCode).toBe(200);
    const disposition = res.headers['content-disposition'] as string;
    expect(disposition).toContain("filename*=UTF-8''");
  });
});
