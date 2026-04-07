import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { describe, expect, it } from 'vitest';
import * as schema from '../schema';

async function createTestDb() {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.join(__dirname, '../migrations') });
  return db;
}

describe('groupCrawledUrls queries', () => {
  it('upsertCrawledUrl inserts a row', async () => {
    const db = await createTestDb();
    const { upsertCrawledUrl, getGroupCrawledUrls } = await import('./groupCrawledUrls');

    await upsertCrawledUrl(db, 'my-group', 'https://example.com/page');
    const results = await getGroupCrawledUrls(db, 'my-group');

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://example.com/page');
    expect(results[0].firstDiscoveredAt).toBeTruthy();
  });

  it('upsertCrawledUrl is idempotent — duplicate inserts do not throw or duplicate', async () => {
    const db = await createTestDb();
    const { upsertCrawledUrl, getGroupCrawledUrls } = await import('./groupCrawledUrls');

    await upsertCrawledUrl(db, 'my-group', 'https://example.com/page');
    await upsertCrawledUrl(db, 'my-group', 'https://example.com/page');
    const results = await getGroupCrawledUrls(db, 'my-group');

    expect(results).toHaveLength(1);
  });

  it('getGroupCrawledUrls only returns URLs for the requested group', async () => {
    const db = await createTestDb();
    const { upsertCrawledUrl, getGroupCrawledUrls } = await import('./groupCrawledUrls');

    await upsertCrawledUrl(db, 'group-a', 'https://a.example.com/');
    await upsertCrawledUrl(db, 'group-b', 'https://b.example.com/');
    const results = await getGroupCrawledUrls(db, 'group-a');

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://a.example.com/');
  });

  it('deleteGroupCrawledUrl removes the specific URL', async () => {
    const db = await createTestDb();
    const { upsertCrawledUrl, getGroupCrawledUrls, deleteGroupCrawledUrl } = await import(
      './groupCrawledUrls'
    );

    await upsertCrawledUrl(db, 'my-group', 'https://example.com/a');
    await upsertCrawledUrl(db, 'my-group', 'https://example.com/b');
    await deleteGroupCrawledUrl(db, 'my-group', 'https://example.com/a');
    const results = await getGroupCrawledUrls(db, 'my-group');

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://example.com/b');
  });

  it('deleteGroupCrawledUrl does not affect other groups', async () => {
    const db = await createTestDb();
    const { upsertCrawledUrl, getGroupCrawledUrls, deleteGroupCrawledUrl } = await import(
      './groupCrawledUrls'
    );

    await upsertCrawledUrl(db, 'group-a', 'https://example.com/page');
    await upsertCrawledUrl(db, 'group-b', 'https://example.com/page');
    await deleteGroupCrawledUrl(db, 'group-a', 'https://example.com/page');

    const a = await getGroupCrawledUrls(db, 'group-a');
    const b = await getGroupCrawledUrls(db, 'group-b');

    expect(a).toHaveLength(0);
    expect(b).toHaveLength(1);
  });
});
