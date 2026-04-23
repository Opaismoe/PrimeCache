import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../schema';
import {
  createSession,
  deleteExpiredSessions,
  deleteSession,
  findActiveSession,
  touchSession,
} from './sessions';

type Db = ReturnType<typeof drizzle<typeof schema>>;

async function createTestDb(): Promise<Db> {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.join(__dirname, '..', 'migrations') });
  return db;
}

let db: Db;

describe('sessions queries', () => {
  beforeEach(async () => {
    db = await createTestDb();
  });

  it('createSession stores a row and findActiveSession returns it', async () => {
    const future = new Date(Date.now() + 3_600_000);
    await createSession(db, { id: 'sid-1', csrfToken: 'csrf-1', expiresAt: future });
    const row = await findActiveSession(db, 'sid-1');
    expect(row).not.toBeNull();
    expect(row?.id).toBe('sid-1');
    expect(row?.csrf_token).toBe('csrf-1');
  });

  it('findActiveSession returns null for an expired session', async () => {
    const past = new Date(Date.now() - 1000);
    await createSession(db, { id: 'sid-expired', csrfToken: 'csrf', expiresAt: past });
    const row = await findActiveSession(db, 'sid-expired');
    expect(row).toBeNull();
  });

  it('findActiveSession returns null for an unknown session id', async () => {
    const row = await findActiveSession(db, 'does-not-exist');
    expect(row).toBeNull();
  });

  it('deleteSession removes the session row', async () => {
    const future = new Date(Date.now() + 3_600_000);
    await createSession(db, { id: 'sid-del', csrfToken: 'csrf', expiresAt: future });
    await deleteSession(db, 'sid-del');
    const row = await findActiveSession(db, 'sid-del');
    expect(row).toBeNull();
  });

  it('touchSession completes without error and session remains findable', async () => {
    const future = new Date(Date.now() + 3_600_000);
    await createSession(db, { id: 'sid-touch', csrfToken: 'csrf', expiresAt: future });
    await expect(touchSession(db, 'sid-touch')).resolves.not.toThrow();
    const after = await findActiveSession(db, 'sid-touch');
    expect(after).not.toBeNull();
    expect(after?.id).toBe('sid-touch');
  });

  it('deleteExpiredSessions removes only expired rows and returns count', async () => {
    const past = new Date(Date.now() - 1000);
    const future = new Date(Date.now() + 3_600_000);
    await createSession(db, { id: 'exp-1', csrfToken: 'csrf', expiresAt: past });
    await createSession(db, { id: 'exp-2', csrfToken: 'csrf', expiresAt: past });
    await createSession(db, { id: 'live-1', csrfToken: 'csrf', expiresAt: future });

    const deleted = await deleteExpiredSessions(db);
    expect(deleted).toBe(2);
    expect(await findActiveSession(db, 'live-1')).not.toBeNull();
  });
});
