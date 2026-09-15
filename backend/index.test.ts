import { describe, expect, it, vi } from 'vitest';

vi.stubEnv('BROWSERLESS_WS_URL', 'ws://browserless:3000/chromium/playwright');
vi.stubEnv('BROWSERLESS_TOKEN', 'test-token');
vi.stubEnv('API_KEY', 'a-valid-api-key-at-least-16');
vi.stubEnv('SECRET_ENCRYPTION_KEY', 'a'.repeat(64));
vi.stubEnv('DATABASE_URL', 'postgres://user:pass@localhost:5432/db');
vi.stubEnv('POSTGRES_PASSWORD', 'testpassword');
vi.stubEnv('ADMIN_USERNAME', 'admin');
vi.stubEnv('ADMIN_PASSWORD', 'password123');

const mockMigrate = vi.fn().mockResolvedValue(undefined);
vi.mock('drizzle-orm/postgres-js/migrator', () => ({ migrate: mockMigrate }));
vi.mock('./db/client', () => ({
  db: { execute: vi.fn().mockResolvedValue(undefined) },
  destroyDb: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./config/secrets', () => ({
  resolveConfigSecrets: vi.fn().mockImplementation((config) => Promise.resolve(config)),
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
vi.mock('./scheduler/index', () => ({
  registerJobs: mockRegisterJobs,
  registerSessionSweep: vi.fn(),
}));
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
    // Wait for the async main() function to execute
    await vi.waitFor(() => {
      expect(order.length).toBeGreaterThan(0);
    });
    expect(order.indexOf('migrate')).toBeLessThan(order.indexOf('listen'));
  });

  it('serves the raw config (secret: references intact) to the API but the resolved config to the scheduler', async () => {
    vi.resetModules();
    mockRegisterJobs.mockClear();
    const rawConfig = {
      groups: [
        {
          name: 'g',
          schedule: '* * * * *',
          urls: ['https://example.com/'],
          options: { basicAuth: { username: 'u', password: 'secret:pw' } },
        },
      ],
    };
    const { loadConfig } = await import('./config/urls');
    vi.mocked(loadConfig).mockReturnValue(rawConfig as never);
    const { resolveConfigSecrets } = await import('./config/secrets');
    vi.mocked(resolveConfigSecrets).mockImplementation(async (cfg) => {
      const clone = structuredClone(cfg);
      clone.groups[0].options.basicAuth = { username: 'u', password: 'PLAINTEXT' };
      return clone;
    });
    const { buildServer } = await import('./api/server');

    await import('./index');
    await vi.waitFor(() => expect(mockRegisterJobs).toHaveBeenCalled());

    const serverDeps = vi.mocked(buildServer).mock.calls.at(-1)?.[0] as never as {
      getConfig: () => typeof rawConfig;
      getResolvedConfig: () => typeof rawConfig;
    };
    expect(serverDeps.getConfig().groups[0].options.basicAuth?.password).toBe('secret:pw');
    expect(serverDeps.getResolvedConfig().groups[0].options.basicAuth?.password).toBe('PLAINTEXT');
    expect(mockRegisterJobs.mock.calls.at(-1)?.[0][0].options.basicAuth?.password).toBe(
      'PLAINTEXT',
    );
  });

  it('applies config reloads in order even when an earlier resolve finishes later', async () => {
    vi.resetModules();
    mockRegisterJobs.mockClear();
    const mk = (name: string) => ({
      groups: [{ name, schedule: '* * * * *', urls: ['https://example.com/'], options: {} }],
    });
    const { loadConfig, watchConfig } = await import('./config/urls');
    vi.mocked(loadConfig).mockReturnValue(mk('boot') as never);
    const { resolveConfigSecrets } = await import('./config/secrets');
    const gates: Record<string, () => void> = {};
    vi.mocked(resolveConfigSecrets).mockImplementation(
      (cfg) =>
        new Promise((resolve) => {
          const name = cfg.groups[0].name;
          if (name === 'boot') return resolve(cfg);
          gates[name] = () => resolve(cfg);
        }),
    );
    const { buildServer } = await import('./api/server');

    await import('./index');
    await vi.waitFor(() => expect(mockRegisterJobs).toHaveBeenCalled());
    const onChange = vi.mocked(watchConfig).mock.calls.at(-1)?.[1] as (c: unknown) => void;
    const serverDeps = vi.mocked(buildServer).mock.calls.at(-1)?.[0] as never as {
      getConfig: () => { groups: Array<{ name: string }> };
    };

    onChange(mk('A'));
    onChange(mk('B'));
    await vi.waitFor(() => expect(gates.A).toBeDefined());
    // B must not start resolving until A has settled
    expect(gates.B).toBeUndefined();
    gates.A();
    await vi.waitFor(() => expect(gates.B).toBeDefined());
    gates.B();
    await vi.waitFor(() => expect(serverDeps.getConfig().groups[0].name).toBe('B'));
  });
});
