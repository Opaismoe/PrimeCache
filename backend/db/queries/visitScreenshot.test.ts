import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { describe, expect, it } from 'vitest';
import * as schema from '../schema';
import { runs, visit_screenshots, visits } from '../schema';

async function createTestDb() {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.join(__dirname, '../migrations') });
  return db;
}

describe('getScreenshotsByRunId', () => {
  it('returns screenshots joined with visit url for a run', async () => {
    const db = await createTestDb();
    const { getScreenshotsByRunId } = await import('./visitScreenshot');

    const [run] = await db
      .insert(runs)
      .values({
        group_name: 'test',
        started_at: new Date('2025-01-01T10:00:00Z'),
        status: 'completed',
      })
      .returning();

    const [visit] = await db
      .insert(visits)
      .values({
        run_id: run.id,
        url: 'https://example.com/',
        load_time_ms: 500,
        visited_at: new Date('2025-01-01T10:01:00Z'),
        error: null,
      })
      .returning();

    await db.insert(visit_screenshots).values({
      visit_id: visit.id,
      image_data: 'base64data==',
      captured_at: new Date('2025-01-01T10:01:01Z'),
    });

    const result = await getScreenshotsByRunId(db, run.id);

    expect(result).toHaveLength(1);
    expect(result[0].visitId).toBe(visit.id);
    expect(result[0].url).toBe('https://example.com/');
    expect(result[0].imageData).toBe('base64data==');
    expect(result[0].capturedAt).toBeInstanceOf(Date);
  });

  it('returns empty array for a run with no screenshots', async () => {
    const db = await createTestDb();
    const { getScreenshotsByRunId } = await import('./visitScreenshot');

    const [run] = await db
      .insert(runs)
      .values({ group_name: 'empty', started_at: new Date(), status: 'completed' })
      .returning();

    await db.insert(visits).values({
      run_id: run.id,
      url: 'https://example.com/no-shot',
      load_time_ms: 200,
      visited_at: new Date(),
      error: null,
    });

    const result = await getScreenshotsByRunId(db, run.id);
    expect(result).toHaveLength(0);
  });

  it('does not return screenshots from other runs', async () => {
    const db = await createTestDb();
    const { getScreenshotsByRunId } = await import('./visitScreenshot');

    const [runA] = await db
      .insert(runs)
      .values({
        group_name: 'g',
        started_at: new Date('2025-01-01T10:00:00Z'),
        status: 'completed',
      })
      .returning();
    const [runB] = await db
      .insert(runs)
      .values({
        group_name: 'g',
        started_at: new Date('2025-01-02T10:00:00Z'),
        status: 'completed',
      })
      .returning();

    const [visitB] = await db
      .insert(visits)
      .values({
        run_id: runB.id,
        url: 'https://example.com/b',
        load_time_ms: 100,
        visited_at: new Date('2025-01-02T10:01:00Z'),
        error: null,
      })
      .returning();

    await db.insert(visit_screenshots).values({
      visit_id: visitB.id,
      image_data: 'only-run-b',
      captured_at: new Date(),
    });

    const resultA = await getScreenshotsByRunId(db, runA.id);
    expect(resultA).toHaveLength(0);

    const resultB = await getScreenshotsByRunId(db, runB.id);
    expect(resultB).toHaveLength(1);
    expect(resultB[0].imageData).toBe('only-run-b');
  });

  it('returns multiple screenshots ordered by visit time', async () => {
    const db = await createTestDb();
    const { getScreenshotsByRunId } = await import('./visitScreenshot');

    const [run] = await db
      .insert(runs)
      .values({
        group_name: 'multi',
        started_at: new Date('2025-01-01T10:00:00Z'),
        status: 'completed',
      })
      .returning();

    const [v1] = await db
      .insert(visits)
      .values({
        run_id: run.id,
        url: 'https://example.com/first',
        load_time_ms: 300,
        visited_at: new Date('2025-01-01T10:01:00Z'),
        error: null,
      })
      .returning();
    const [v2] = await db
      .insert(visits)
      .values({
        run_id: run.id,
        url: 'https://example.com/second',
        load_time_ms: 400,
        visited_at: new Date('2025-01-01T10:02:00Z'),
        error: null,
      })
      .returning();

    await db.insert(visit_screenshots).values([
      { visit_id: v1.id, image_data: 'img1', captured_at: new Date('2025-01-01T10:01:01Z') },
      { visit_id: v2.id, image_data: 'img2', captured_at: new Date('2025-01-01T10:02:01Z') },
    ]);

    const result = await getScreenshotsByRunId(db, run.id);
    expect(result).toHaveLength(2);
    expect(result[0].url).toBe('https://example.com/first');
    expect(result[1].url).toBe('https://example.com/second');
  });
});
