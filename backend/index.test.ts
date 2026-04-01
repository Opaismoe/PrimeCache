import { describe, expect, it, vi } from 'vitest';

vi.stubEnv('BROWSERLESS_WS_URL', 'ws://browserless:3000/chromium/playwright');
vi.stubEnv('BROWSERLESS_TOKEN', 'test-token');
vi.stubEnv('API_KEY', 'a-valid-api-key-at-least-16');
vi.stubEnv('ADMIN_USERNAME', 'admin');
vi.stubEnv('ADMIN_PASSWORD', 'password123');

const mockMigrate = vi.fn().mockResolvedValue(undefined);
vi.mock('drizzle-orm/postgres-js/migrator', () => ({ migrate: mockMigrate }));
vi.mock('./db/client', () => ({
  db: {},
  destroyDb: vi.fn().mockResolvedValue(undefined),
}));

const mockListen = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn().mockResolvedValue(undefined);
vi.mock('./api/server', () => ({
  buildServer: vi.fn().mockResolvedValue({
    listen: mockListen,
    close: mockClose,
    ready: vi.fn().mockResolvedValue(undefined),
  }),
}));

const mockRegisterJobs = vi.fn();
vi.mock('./scheduler/index', () => ({ registerJobs: mockRegisterJobs }));
vi.mock('./browser/connection', () => ({ disconnect: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./config/urls', () => ({
  loadConfig: vi.fn().mockReturnValue({ groups: [] }),
  watchConfig: vi.fn().mockReturnValue(() => {}),
}));

describe('boot sequence', () => {
  it('runs migrations before starting the API server', async () => {
    vi.resetModules();
    const order: string[] = [];
    mockMigrate.mockImplementation(async () => {
      order.push('migrate');
    });
    mockListen.mockImplementation(async () => {
      order.push('listen');
    });

    await import('./index');
    expect(order.indexOf('migrate')).toBeLessThan(order.indexOf('listen'));
  });
});
