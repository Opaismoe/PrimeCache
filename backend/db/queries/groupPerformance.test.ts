import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { describe, expect, it } from 'vitest';
import * as schema from '../schema';
import { runs, visits } from '../schema';

async function createTestDb() {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.join(__dirname, '../migrations') });
  return db;
}

describe('getGroupPerformance — cancelled run exclusion', () => {
  it('excludes cancelled run visits from performance metrics', async () => {
    const db = await createTestDb();
    const { getGroupPerformance } = await import('./groupPerformance');

    const [completed] = await db
      .insert(runs)
      .values({
        group_name: 'perf-cancel',
        started_at: new Date('2025-01-01T10:00:00Z'),
        status: 'completed',
      })
      .returning();
    await db.insert(visits).values({
      run_id: completed.id,
      url: 'https://d.com/',
      load_time_ms: 500,
      visited_at: new Date('2025-01-01T10:01:00Z'),
      error: null,
    });

    const [cancelled] = await db
      .insert(runs)
      .values({
        group_name: 'perf-cancel',
        started_at: new Date('2025-01-02T10:00:00Z'),
        status: 'cancelled',
      })
      .returning();
    await db.insert(visits).values({
      run_id: cancelled.id,
      url: 'https://d.com/',
      load_time_ms: 9999,
      visited_at: new Date('2025-01-02T10:01:00Z'),
      error: 'aborted',
    });

    const result = await getGroupPerformance(db, 'perf-cancel');
    expect(result.urls[0].p50LoadTimeMs).toBe(500);
    expect(result.loadTimeTrend).toHaveLength(1);
  });
});
