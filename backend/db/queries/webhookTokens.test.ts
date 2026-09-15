import { createHash } from 'node:crypto';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../schema';
import { webhook_tokens } from '../schema';
import { createWebhookToken, findWebhookToken, listWebhookTokens } from './webhookTokens';

type Db = ReturnType<typeof drizzle<typeof schema>>;
let db: Db;

async function createTestDb(): Promise<Db> {
  const client = new PGlite();
  const instance = drizzle({ client, schema });
  await migrate(instance, { migrationsFolder: path.join(__dirname, '../migrations') });
  return instance;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

describe('webhook tokens at rest', () => {
  beforeEach(async () => {
    db = await createTestDb();
  });

  it('createWebhookToken returns the plaintext token once but stores only its sha256', async () => {
    const created = await createWebhookToken(db, { groupName: 'homepage' });
    expect(created.token).toMatch(/^[0-9a-f]{64}$/);

    const [row] = await db.select().from(webhook_tokens).where(eq(webhook_tokens.id, created.id));
    expect(row.token).not.toBe(created.token);
    expect(row.token).toBe(sha256(created.token));
  });

  it('findWebhookToken looks up by plaintext and returns the row', async () => {
    const created = await createWebhookToken(db, { groupName: 'homepage' });
    const found = await findWebhookToken(db, created.token);
    expect(found?.id).toBe(created.id);
    expect(await findWebhookToken(db, 'not-a-token')).toBeNull();
  });

  it('migration hashes pre-existing plaintext tokens', async () => {
    // Simulate a row written by the old code path (plaintext token), then re-run
    // the hashing statement from the migration and verify the lookup still works.
    const plaintext = 'a'.repeat(64);
    await db.insert(webhook_tokens).values({ group_name: 'homepage', token: plaintext });
    await db.execute(
      sql`UPDATE webhook_tokens SET token = encode(sha256(convert_to(token, 'UTF8')), 'hex')`,
    );
    const found = await findWebhookToken(db, plaintext);
    expect(found?.group_name).toBe('homepage');
  });

  it('listWebhookTokens never returns the token column', async () => {
    await createWebhookToken(db, { groupName: 'homepage' });
    const [row] = await listWebhookTokens(db, 'homepage');
    expect(row).not.toHaveProperty('token');
  });

  it('listWebhookTokens reports how many runs each token fired and how many completed', async () => {
    const { insertRun, finalizeRun } = await import('./runs');
    const t = await createWebhookToken(db, { groupName: 'homepage' });
    const ok = await insertRun(db, {
      groupName: 'homepage',
      totalUrls: 1,
      triggeredBy: 'webhook',
      webhookTokenId: t.id,
    });
    await finalizeRun(db, ok, { status: 'completed', successCount: 1, failureCount: 0 });
    const bad = await insertRun(db, {
      groupName: 'homepage',
      totalUrls: 1,
      triggeredBy: 'webhook',
      webhookTokenId: t.id,
    });
    await finalizeRun(db, bad, { status: 'failed', successCount: 0, failureCount: 1 });
    await insertRun(db, { groupName: 'homepage', totalUrls: 1, triggeredBy: 'schedule' });

    const [row] = await listWebhookTokens(db, 'homepage');
    expect(row.fire_count).toBe(2);
    expect(row.success_count).toBe(1);
  });
});
