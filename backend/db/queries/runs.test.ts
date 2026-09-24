import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { describe, expect, it } from 'vitest';
import * as schema from '../schema';
import { runs, visits } from '../schema';
import { getRuns } from './runs';

async function createTestDb() {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.join(__dirname, '../migrations') });
  return db;
}

describe('getRuns — per-run load/TTFB averages', () => {
  it('includes avg_load_time_ms and avg_ttfb_ms, ignoring null TTFB and null for runs without visits', async () => {
    const db = await createTestDb();
    const [run] = await db
      .insert(runs)
      .values({ group_name: 'g', started_at: new Date(), status: 'completed' })
      .returning();
    const [empty] = await db
      .insert(runs)
      .values({ group_name: 'g', started_at: new Date(), status: 'running' })
      .returning();
    const base = { run_id: run.id, visited_at: new Date(), error: null };
    await db.insert(visits).values([
      { ...base, url: 'https://a.com/', load_time_ms: 300, ttfb_ms: 100 },
      { ...base, url: 'https://b.com/', load_time_ms: 500, ttfb_ms: 200 },
      { ...base, url: 'https://c.com/', load_time_ms: 400, ttfb_ms: null },
    ]);

    const result = await getRuns(db, { limit: 10, offset: 0 });
    const byId = new Map(result.map((r) => [r.id, r]));
    expect(byId.get(run.id)?.avg_load_time_ms).toBe(400);
    expect(byId.get(run.id)?.avg_ttfb_ms).toBe(150);
    expect(byId.get(empty.id)?.avg_load_time_ms).toBeNull();
    expect(byId.get(empty.id)?.avg_ttfb_ms).toBeNull();
  });
});
