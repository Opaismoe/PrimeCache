import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import { upsertSecret } from '../db/queries/secrets';
import { encrypt } from '../secrets/crypto';
import type { Config } from './urls';
import { resolveConfigSecrets } from './secrets';

const VALID_KEY = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

// Stub SECRET_ENCRYPTION_KEY env var before importing the module under test
process.env.SECRET_ENCRYPTION_KEY = VALID_KEY;

type Db = ReturnType<typeof drizzle<typeof schema>>;

async function createTestDb(): Promise<Db> {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.join(__dirname, '..', 'db', 'migrations') });
  return db;
}

function makeConfig(overrides: Partial<Config['groups'][number]['options']> = {}): Config {
  return {
    groups: [
      {
        name: 'test-group',
        schedule: '0 * * * *',
        urls: ['https://example.com'],
        options: {
          scrollToBottom: false,
          crawl: false,
          navigationTimeout: 30_000,
          waitUntil: 'networkidle',
          fetchAssets: true,
          stealth: true,
          screenshot: false,
          checkBrokenLinks: false,
          checkAccessibility: false,
          retryCount: 3,
          ...overrides,
        },
      },
    ],
  };
}

describe('resolveConfigSecrets', () => {
  let db: Db;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it('resolves secret:name in basicAuth.password', async () => {
    const plaintext = 'my-password';
    await upsertSecret(db, 'homepage-basic-auth', encrypt(plaintext, VALID_KEY));
    const config = makeConfig({
      basicAuth: { username: 'admin', password: 'secret:homepage-basic-auth' },
    });
    const resolved = await resolveConfigSecrets(config, db);
    expect(resolved.groups[0].options.basicAuth?.password).toBe(plaintext);
  });

  it('resolves secret:name in cookies[].value', async () => {
    const cookieVal = 'my-session-token';
    await upsertSecret(db, 'shop-session', encrypt(cookieVal, VALID_KEY));
    const config = makeConfig({
      cookies: [{ name: 'session', value: 'secret:shop-session', domain: 'example.com' }],
    });
    const resolved = await resolveConfigSecrets(config, db);
    expect(resolved.groups[0].options.cookies?.[0].value).toBe(cookieVal);
  });

  it('leaves plain string values unchanged', async () => {
    const config = makeConfig({
      basicAuth: { username: 'admin', password: 'plain-password' },
    });
    const resolved = await resolveConfigSecrets(config, db);
    expect(resolved.groups[0].options.basicAuth?.password).toBe('plain-password');
  });

  it('throws with a clear message when referenced secret does not exist', async () => {
    const config = makeConfig({
      basicAuth: { username: 'admin', password: 'secret:nonexistent' },
    });
    await expect(resolveConfigSecrets(config, db)).rejects.toThrow('nonexistent');
  });

  it('returns a deep copy — does not mutate the input config', async () => {
    const config = makeConfig({
      basicAuth: { username: 'admin', password: 'plain' },
    });
    const resolved = await resolveConfigSecrets(config, db);
    expect(resolved).not.toBe(config);
    expect(resolved.groups).not.toBe(config.groups);
  });
});
