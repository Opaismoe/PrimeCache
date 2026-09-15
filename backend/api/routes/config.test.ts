import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../db/client';
import { upsertSecret } from '../../db/queries/secrets';
import * as schema from '../../db/schema';
import { encrypt } from '../../secrets/crypto';

vi.stubEnv('API_KEY', 'supersecretapikey1234');
vi.stubEnv('CONFIG_PATH', '/tmp/test-config.yaml');
vi.stubEnv('COOKIE_SECURE', 'false');

const writeFileSync = vi.fn();
vi.mock('node:fs', () => ({ writeFileSync: (...a: unknown[]) => writeFileSync(...a) }));
vi.mock('../../warmer/runner', () => ({
  runGroup: vi.fn().mockResolvedValue(1),
  startRunGroup: vi.fn().mockResolvedValue({ runId: 1, promise: Promise.resolve() }),
}));

const KEY = process.env.SECRET_ENCRYPTION_KEY as string;
const API_KEY = 'supersecretapikey1234';

const config = {
  groups: [
    { name: 'homepage', schedule: '*/15 * * * *', urls: ['https://example.com/'], options: {} },
  ],
};

let app: FastifyInstance;
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  const client = new PGlite();
  db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.join(__dirname, '../../db/migrations') });
  const { buildServer } = await import('../server');
  app = await buildServer({ db: db as unknown as Db, getConfig: () => config as never });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

const put = (body: unknown) =>
  app.inject({
    method: 'PUT',
    url: '/api/config',
    headers: { 'x-api-key': API_KEY, 'content-type': 'application/json' },
    payload: body,
  });

describe('PUT /api/config — secret reference validation', () => {
  it('rejects a config that references a secret that does not exist', async () => {
    const res = await put({
      groups: [
        {
          ...config.groups[0],
          options: { basicAuth: { username: 'u', password: 'secret:nope' } },
        },
      ],
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().missingSecrets).toEqual(['nope']);
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('accepts a config whose secret references all exist', async () => {
    await upsertSecret(db as unknown as Db, 'pw', encrypt('x', KEY));
    const res = await put({
      groups: [
        {
          ...config.groups[0],
          options: { basicAuth: { username: 'u', password: 'secret:pw' } },
        },
      ],
    });
    expect(res.statusCode).toBe(200);
    expect(writeFileSync).toHaveBeenCalledOnce();
  });
});
