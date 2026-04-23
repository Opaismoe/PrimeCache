import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../utils/logger';
import { safeCookieHeader } from './lighthouseAudit';

// Stub required env vars before any module under test imports them
vi.stubEnv('BROWSERLESS_WS_URL', 'ws://browserless:3000/chromium/playwright');
vi.stubEnv('BROWSERLESS_TOKEN', 'super-secret-token');
vi.stubEnv('BROWSERLESS_HTTP_URL', 'http://browserless:3000');
vi.stubEnv('API_KEY', 'supersecretapikey1234');
vi.stubEnv('DATABASE_URL', 'postgres://user:pass@localhost:5432/db');
vi.stubEnv(
  'SECRET_ENCRYPTION_KEY',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
);
vi.stubEnv('ADMIN_USERNAME', 'admin');
vi.stubEnv('ADMIN_PASSWORD', 'password123');

describe('runLighthouseAudit — error log redaction', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not include BROWSERLESS_TOKEN in the error log payload', async () => {
    const { runLighthouseAudit } = await import('./lighthouseAudit');
    await runLighthouseAudit('https://example.com');

    expect(errorSpy).toHaveBeenCalledOnce();
    const [logPayload] = errorSpy.mock.calls[0] as [Record<string, unknown>, ...unknown[]];

    // Must not contain the raw token
    expect(JSON.stringify(logPayload)).not.toContain('super-secret-token');

    // Must not contain a ?token= query parameter
    expect(JSON.stringify(logPayload)).not.toContain('?token=');

    // Must not have an 'endpoint' key (that is where the token was leaking)
    expect(logPayload).not.toHaveProperty('endpoint');
  });

  it('includes url, base, and path in the error log payload', async () => {
    const { runLighthouseAudit } = await import('./lighthouseAudit');
    await runLighthouseAudit('https://example.com');

    expect(errorSpy).toHaveBeenCalledOnce();
    const [logPayload] = errorSpy.mock.calls[0] as [Record<string, unknown>, ...unknown[]];

    expect(logPayload).toHaveProperty('url', 'https://example.com');
    expect(logPayload).toHaveProperty('base', 'http://browserless:3000');
    expect(logPayload).toHaveProperty('path', '/chromium/performance');
  });
});

// ── safeCookieHeader unit tests (W11) ────────────────────────────────────────

describe('safeCookieHeader (W11)', () => {
  it('returns undefined for empty cookie array', () => {
    expect(safeCookieHeader([])).toBeUndefined();
  });

  it('drops cookies whose value contains a semicolon', () => {
    const result = safeCookieHeader([{ name: 'x', value: 'a; Set-Cookie: evil=1' }]);
    expect(result).toBeUndefined();
  });

  it('drops cookies whose name contains a semicolon', () => {
    const result = safeCookieHeader([{ name: 'bad;name', value: 'ok' }]);
    expect(result).toBeUndefined();
  });

  it('drops cookies whose value contains \\r', () => {
    const result = safeCookieHeader([{ name: 'x', value: 'val\rinjection' }]);
    expect(result).toBeUndefined();
  });

  it('drops cookies whose value contains \\n', () => {
    const result = safeCookieHeader([{ name: 'x', value: 'val\ninjection' }]);
    expect(result).toBeUndefined();
  });

  it('URL-encodes values containing = characters', () => {
    const result = safeCookieHeader([{ name: 'token', value: 'abc=def' }]);
    expect(result).toBe('token=abc%3Ddef');
  });

  it('includes only safe cookies when mixed with unsafe ones', () => {
    const result = safeCookieHeader([
      { name: 'safe', value: 'ok' },
      { name: 'bad', value: 'evil; inject' },
    ]);
    expect(result).toBe('safe=ok');
  });

  it('joins multiple safe cookies with "; "', () => {
    const result = safeCookieHeader([
      { name: 'a', value: '1' },
      { name: 'b', value: '2' },
    ]);
    expect(result).toBe('a=1; b=2');
  });
});
