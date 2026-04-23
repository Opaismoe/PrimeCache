import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../utils/logger';

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
