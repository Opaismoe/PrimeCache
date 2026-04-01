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

describe('getGroupUptime', () => {
  it('returns uptimeTrend with per-run per-URL wasDown status', async () => {
    const db = await createTestDb();
    const { getGroupUptime } = await import('./groupUptime');

    const [run1] = await db
      .insert(runs)
      .values({
        group_name: 'test',
        started_at: new Date('2025-01-01T10:00:00Z'),
        status: 'completed',
      })
      .returning();

    await db.insert(visits).values([
      {
        run_id: run1.id,
        url: 'https://example.com/',
        load_time_ms: 400,
        visited_at: new Date('2025-01-01T10:01:00Z'),
        error: null,
      },
      {
        run_id: run1.id,
        url: 'https://example.com/page',
        load_time_ms: 500,
        visited_at: new Date('2025-01-01T10:02:00Z'),
        error: 'timeout',
      },
    ]);

    const result = await getGroupUptime(db, 'test');

    expect(result.uptimeTrend).toBeDefined();
    expect(result.uptimeTrend.length).toBeGreaterThan(0);

    const home = result.uptimeTrend.find((p) => p.url === 'https://example.com/');
    const page = result.uptimeTrend.find((p) => p.url === 'https://example.com/page');

    expect(home).toBeDefined();
    expect(home?.wasDown).toBe(false);
    expect(page).toBeDefined();
    expect(page?.wasDown).toBe(true);
  });

  it('uptimeTrend points have runId, startedAt, url, wasDown', async () => {
    const db = await createTestDb();
    const { getGroupUptime } = await import('./groupUptime');

    const [run] = await db
      .insert(runs)
      .values({
        group_name: 'test2',
        started_at: new Date('2025-02-01T08:00:00Z'),
        status: 'completed',
      })
      .returning();

    await db.insert(visits).values({
      run_id: run.id,
      url: 'https://site.com/',
      load_time_ms: 300,
      visited_at: new Date('2025-02-01T08:01:00Z'),
      error: null,
    });

    const result = await getGroupUptime(db, 'test2');
    const pt = result.uptimeTrend[0];

    expect(typeof pt.runId).toBe('number');
    expect(typeof pt.startedAt).toBe('string');
    expect(new Date(pt.startedAt).toISOString()).toBe(pt.startedAt);
    expect(typeof pt.url).toBe('string');
    expect(typeof pt.wasDown).toBe('boolean');
  });

  it('returns empty uptimeTrend for unknown group', async () => {
    const db = await createTestDb();
    const { getGroupUptime } = await import('./groupUptime');

    const result = await getGroupUptime(db, 'no-such-group');
    expect(result.uptimeTrend).toEqual([]);
  });
});

describe('getGroupUptime — cancelled run exclusion', () => {
  it('excludes cancelled runs from uptime calculations', async () => {
    const db = await createTestDb();
    const { getGroupUptime } = await import('./groupUptime');

    const [completed] = await db
      .insert(runs)
      .values({
        group_name: 'uptime-cancel',
        started_at: new Date('2025-01-01T10:00:00Z'),
        status: 'completed',
      })
      .returning();
    await db.insert(visits).values({
      run_id: completed.id,
      url: 'https://b.com/',
      load_time_ms: 300,
      visited_at: new Date('2025-01-01T10:01:00Z'),
      error: null,
    });

    const [cancelled] = await db
      .insert(runs)
      .values({
        group_name: 'uptime-cancel',
        started_at: new Date('2025-01-02T10:00:00Z'),
        status: 'cancelled',
      })
      .returning();
    await db.insert(visits).values({
      run_id: cancelled.id,
      url: 'https://b.com/',
      load_time_ms: 0,
      visited_at: new Date('2025-01-02T10:01:00Z'),
      error: 'timeout',
    });

    const result = await getGroupUptime(db, 'uptime-cancel');
    expect(result.urls[0].uptimePct).toBe(100);
    expect(result.uptimeTrend).toHaveLength(1);
  });
});
