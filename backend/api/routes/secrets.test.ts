import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../db/client';
import { getSecret, upsertSecret } from '../../db/queries/secrets';
import * as schema from '../../db/schema';
import { encrypt } from '../../secrets/crypto';

vi.stubEnv('API_KEY', 'supersecretapikey1234');
vi.stubEnv('COOKIE_SECURE', 'false');

vi.mock('../../warmer/runner', () => ({
  runGroup: vi.fn().mockResolvedValue(1),
  startRunGroup: vi.fn().mockResolvedValue({ runId: 1, promise: Promise.resolve() }),
}));

const KEY = process.env.SECRET_ENCRYPTION_KEY as string;
const API_KEY = 'supersecretapikey1234';

const config = {
  groups: [
    {
      name: 'homepage',
      schedule: '*/15 * * * *',
      urls: ['https://example.com/'],
      options: { basicAuth: { username: 'u', password: 'secret:in-use' } },
    },
  ],
};

let app: FastifyInstance;
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeEach(async () => {
  vi.resetModules();
  const client = new PGlite();
  db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.join(__dirname, '../../db/migrations') });
  await upsertSecret(db as unknown as Db, 'in-use', encrypt('x', KEY));
  await upsertSecret(db as unknown as Db, 'unused', encrypt('y', KEY));
  const { buildServer } = await import('../server');
  app = await buildServer({ db: db as unknown as Db, getConfig: () => config as never });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('DELETE /api/secrets/:name', () => {
  it('refuses to delete a secret the current config references', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/secrets/in-use',
      headers: { 'x-api-key': API_KEY },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().referencedBy).toEqual(['homepage']);
    expect(await getSecret(db as unknown as Db, 'in-use')).not.toBeNull();
  });

  it('deletes a secret nothing references', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/secrets/unused',
      headers: { 'x-api-key': API_KEY },
    });
    expect(res.statusCode).toBe(200);
    expect(await getSecret(db as unknown as Db, 'unused')).toBeNull();
  });
});
