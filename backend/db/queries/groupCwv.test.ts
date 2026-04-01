import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { describe, expect, it } from 'vitest';
import * as schema from '../schema';
import { runs, visit_cwv, visits } from '../schema';

async function createTestDb() {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.join(__dirname, '../migrations') });
  return db;
}

describe('getGroupCwv', () => {
  it('returns per-URL P75 CWV metrics', async () => {
    const db = await createTestDb();
    const { getGroupCwv } = await import('./groupCwv');

    const [run] = await db
      .insert(runs)
      .values({
        group_name: 'cwv-test',
        started_at: new Date('2025-04-01T10:00:00Z'),
        status: 'completed',
      })
      .returning();

    const [v1] = await db
      .insert(visits)
      .values({
        run_id: run.id,
        url: 'https://example.com/',
        load_time_ms: 400,
        visited_at: new Date('2025-04-01T10:01:00Z'),
        error: null,
      })
      .returning();

    await db.insert(visit_cwv).values({
      visit_id: v1.id,
      lcp_ms: 1200,
      fcp_ms: 800,
      cls_score: 0.05,
      inp_ms: 150,
    });

    const result = await getGroupCwv(db, 'cwv-test');

    expect(result.urls).toHaveLength(1);
    const url = result.urls[0];
    expect(url.url).toBe('https://example.com/');
    expect(url.sampleCount).toBe(1);
    expect(url.lcpP75).toBe(1200);
    expect(url.fcpP75).toBe(800);
    expect(url.clsP75).toBeCloseTo(0.05, 2);
    expect(url.inpP75).toBe(150);
  });

  it('assigns correct status labels based on CWV thresholds', async () => {
    const db = await createTestDb();
    const { getGroupCwv } = await import('./groupCwv');

    const [run] = await db
      .insert(runs)
      .values({
        group_name: 'cwv-status',
        started_at: new Date('2025-04-02T10:00:00Z'),
        status: 'completed',
      })
      .returning();

    const [v] = await db
      .insert(visits)
      .values({
        run_id: run.id,
        url: 'https://slow.com/',
        load_time_ms: 8000,
        visited_at: new Date('2025-04-02T10:01:00Z'),
        error: null,
      })
      .returning();

    // Poor LCP (≥4000), poor FCP (≥3000), poor CLS (≥0.25), poor INP (≥500)
    await db.insert(visit_cwv).values({
      visit_id: v.id,
      lcp_ms: 5000,
      fcp_ms: 4000,
      cls_score: 0.3,
      inp_ms: 600,
    });

    const result = await getGroupCwv(db, 'cwv-status');
    const url = result.urls[0];
    expect(url.lcpStatus).toBe('poor');
    expect(url.fcpStatus).toBe('poor');
    expect(url.clsStatus).toBe('poor');
    expect(url.inpStatus).toBe('poor');
  });

  it('returns good status for fast pages', async () => {
    const db = await createTestDb();
    const { getGroupCwv } = await import('./groupCwv');

    const [run] = await db
      .insert(runs)
      .values({
        group_name: 'cwv-good',
        started_at: new Date('2025-04-03T10:00:00Z'),
        status: 'completed',
      })
      .returning();

    const [v] = await db
      .insert(visits)
      .values({
        run_id: run.id,
        url: 'https://fast.com/',
        load_time_ms: 200,
        visited_at: new Date('2025-04-03T10:01:00Z'),
        error: null,
      })
      .returning();

    await db.insert(visit_cwv).values({
      visit_id: v.id,
      lcp_ms: 1000,
      fcp_ms: 900,
      cls_score: 0.02,
      inp_ms: 80,
    });

    const result = await getGroupCwv(db, 'cwv-good');
    const url = result.urls[0];
    expect(url.lcpStatus).toBe('good');
    expect(url.fcpStatus).toBe('good');
    expect(url.clsStatus).toBe('good');
    expect(url.inpStatus).toBe('good');
  });

  it('returns trend points per run', async () => {
    const db = await createTestDb();
    const { getGroupCwv } = await import('./groupCwv');

    const [run1] = await db
      .insert(runs)
      .values({
        group_name: 'cwv-trend',
        started_at: new Date('2025-04-01T10:00:00Z'),
        status: 'completed',
      })
      .returning();

    const [run2] = await db
      .insert(runs)
      .values({
        group_name: 'cwv-trend',
        started_at: new Date('2025-04-02T10:00:00Z'),
        status: 'completed',
      })
      .returning();

    for (const [run, lcp] of [
      [run1, 2000],
      [run2, 3000],
    ] as const) {
      const [v] = await db
        .insert(visits)
        .values({
          run_id: run.id,
          url: 'https://trend.com/',
          load_time_ms: lcp,
          visited_at: new Date('2025-04-01T10:01:00Z'),
          error: null,
        })
        .returning();
      await db
        .insert(visit_cwv)
        .values({ visit_id: v.id, lcp_ms: lcp, fcp_ms: null, cls_score: null, inp_ms: null });
    }

    const result = await getGroupCwv(db, 'cwv-trend');
    expect(result.trend).toHaveLength(2);
    expect(result.trend[0].avgLcpMs).toBe(2000);
    expect(result.trend[1].avgLcpMs).toBe(3000);
    expect(typeof result.trend[0].startedAt).toBe('string');
  });

  it('returns empty for unknown group', async () => {
    const db = await createTestDb();
    const { getGroupCwv } = await import('./groupCwv');

    const result = await getGroupCwv(db, 'no-such-group');
    expect(result.urls).toEqual([]);
    expect(result.trend).toEqual([]);
  });

  it('returns urlTrend field (even if empty array)', async () => {
    const db = await createTestDb();
    const { getGroupCwv } = await import('./groupCwv');

    const result = await getGroupCwv(db, 'no-such-group-urltrend');
    expect(Array.isArray(result.urlTrend)).toBe(true);
    expect(result.urlTrend).toEqual([]);
  });
});

describe('getGroupCwvPerUrlTrend', () => {
  it('returns rows grouped by (run_id, url) with correct metrics, ordered oldest-first', async () => {
    const db = await createTestDb();
    const { getGroupCwvPerUrlTrend } = await import('./groupCwv');

    const [run1] = await db
      .insert(runs)
      .values({
        group_name: 'cwv-url-trend',
        started_at: new Date('2025-05-01T10:00:00Z'),
        status: 'completed',
      })
      .returning();

    const [run2] = await db
      .insert(runs)
      .values({
        group_name: 'cwv-url-trend',
        started_at: new Date('2025-05-02T10:00:00Z'),
        status: 'completed',
      })
      .returning();

    for (const [run, lcp, fcp, cls, inp, ttfb, url] of [
      [run1, 1200, 800, 0.05, 150, 200, 'https://example.com/'],
      [run1, 2000, 1000, 0.1, 200, 300, 'https://example.com/page2'],
      [run2, 1400, 900, 0.04, 130, 180, 'https://example.com/'],
      [run2, 2200, 1100, 0.12, 210, 320, 'https://example.com/page2'],
    ] as const) {
      const [v] = await db
        .insert(visits)
        .values({
          run_id: run.id,
          url,
          load_time_ms: lcp,
          ttfb_ms: ttfb,
          visited_at: new Date('2025-05-01T10:01:00Z'),
          error: null,
        })
        .returning();
      await db
        .insert(visit_cwv)
        .values({ visit_id: v.id, lcp_ms: lcp, fcp_ms: fcp, cls_score: cls, inp_ms: inp });
    }

    const result = await getGroupCwvPerUrlTrend(db, 'cwv-url-trend');

    // 2 runs * 2 URLs = 4 rows
    expect(result).toHaveLength(4);

    // Ordered oldest-first
    const run1Rows = result.filter((r) => r.runId === run1.id);
    const run2Rows = result.filter((r) => r.runId === run2.id);
    expect(run1Rows).toHaveLength(2);
    expect(run2Rows).toHaveLength(2);

    // run1 comes before run2
    expect(result[0].runId).toBe(run1.id);

    // Check a specific row
    const r1url1 = run1Rows.find((r) => r.url === 'https://example.com/');
    expect(r1url1).toBeDefined();
    expect(r1url1?.avgLcpMs).toBe(1200);
    expect(r1url1?.avgFcpMs).toBe(800);
    expect(r1url1?.avgClsScore).toBeCloseTo(0.05, 3);
    expect(r1url1?.avgInpMs).toBe(150);
    // TTFB comes from visits.ttfb_ms
    expect(r1url1?.avgTtfbMs).toBe(200);
    expect(typeof r1url1?.startedAt).toBe('string');
  });

  it('returns [] when there is no CWV data for the group', async () => {
    const db = await createTestDb();
    const { getGroupCwvPerUrlTrend } = await import('./groupCwv');

    const result = await getGroupCwvPerUrlTrend(db, 'no-cwv-data-group');
    expect(result).toEqual([]);
  });
});

describe('getGroupCwv — cancelled run exclusion', () => {
  it('excludes CWV data from cancelled runs', async () => {
    const db = await createTestDb();
    const { getGroupCwv } = await import('./groupCwv');

    const [completed] = await db
      .insert(runs)
      .values({
        group_name: 'cwv-cancel',
        started_at: new Date('2025-01-01T10:00:00Z'),
        status: 'completed',
      })
      .returning();
    const [v1] = await db
      .insert(visits)
      .values({
        run_id: completed.id,
        url: 'https://a.com/',
        load_time_ms: 400,
        visited_at: new Date('2025-01-01T10:01:00Z'),
        error: null,
      })
      .returning();
    await db
      .insert(visit_cwv)
      .values({ visit_id: v1.id, lcp_ms: 1000, fcp_ms: 800, cls_score: 0.05, inp_ms: 100 });

    const [cancelled] = await db
      .insert(runs)
      .values({
        group_name: 'cwv-cancel',
        started_at: new Date('2025-01-02T10:00:00Z'),
        status: 'cancelled',
      })
      .returning();
    const [v2] = await db
      .insert(visits)
      .values({
        run_id: cancelled.id,
        url: 'https://a.com/',
        load_time_ms: 9999,
        visited_at: new Date('2025-01-02T10:01:00Z'),
        error: null,
      })
      .returning();
    await db
      .insert(visit_cwv)
      .values({ visit_id: v2.id, lcp_ms: 9999, fcp_ms: 9999, cls_score: 9.99, inp_ms: 9999 });

    const result = await getGroupCwv(db, 'cwv-cancel');
    expect(result.urls[0].lcpP75).toBe(1000);
    expect(result.trend).toHaveLength(1);
    expect(result.urlTrend).toHaveLength(1);
  });
});
