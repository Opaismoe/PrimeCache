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

describe('lighthouse queries', () => {
  it('insertLighthouseReport inserts a row', async () => {
    const db = await createTestDb();
    const { insertLighthouseReport, getGroupLighthouse } = await import('./lighthouse');

    await insertLighthouseReport(db, 'test-group', 'manual', {
      url: 'https://example.com/',
      performanceScore: 90,
      accessibilityScore: 85,
      seoScore: 95,
      bestPracticesScore: 80,
      lcpMs: 1200,
      fcpMs: 800,
      clsScore: 0.05,
      tbtMs: 100,
      speedIndexMs: 1500,
      inpMs: 200,
      ttfbMs: 300,
      failed: false,
      error: null,
    });

    const results = await getGroupLighthouse(db, 'test-group');
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://example.com/');
    expect(results[0].latestReport).not.toBeNull();
    expect(results[0].latestReport?.performanceScore).toBe(90);
    expect(results[0].latestReport?.accessibilityScore).toBe(85);
    expect(results[0].latestReport?.seoScore).toBe(95);
    expect(results[0].latestReport?.bestPracticesScore).toBe(80);
    expect(results[0].latestReport?.lcpMs).toBe(1200);
    expect(results[0].latestReport?.failed).toBe(false);
    expect(results[0].latestReport?.error).toBeNull();
    expect(results[0].latestReport?.triggeredBy).toBe('manual');
  });

  it('getGroupLighthouse returns the latest report per URL', async () => {
    const db = await createTestDb();
    const { insertLighthouseReport, getGroupLighthouse } = await import('./lighthouse');

    await insertLighthouseReport(db, 'perf-group', 'schedule', {
      url: 'https://a.com/',
      performanceScore: 70,
      accessibilityScore: null,
      seoScore: null,
      bestPracticesScore: null,
      lcpMs: null,
      fcpMs: null,
      clsScore: null,
      tbtMs: null,
      speedIndexMs: null,
      inpMs: null,
      ttfbMs: null,
      failed: false,
      error: null,
    });

    await insertLighthouseReport(db, 'perf-group', 'schedule', {
      url: 'https://b.com/',
      performanceScore: 50,
      accessibilityScore: null,
      seoScore: null,
      bestPracticesScore: null,
      lcpMs: null,
      fcpMs: null,
      clsScore: null,
      tbtMs: null,
      speedIndexMs: null,
      inpMs: null,
      ttfbMs: null,
      failed: false,
      error: null,
    });

    const results = await getGroupLighthouse(db, 'perf-group');
    expect(results).toHaveLength(2);
    const urls = results.map((r) => r.url).sort();
    expect(urls).toEqual(['https://a.com/', 'https://b.com/']);
  });

  it('multiple reports for same URL returns only the latest', async () => {
    const db = await createTestDb();
    const { insertLighthouseReport, getGroupLighthouse } = await import('./lighthouse');

    // Insert older report first
    await insertLighthouseReport(db, 'latest-group', 'schedule', {
      url: 'https://site.com/',
      performanceScore: 60,
      accessibilityScore: null,
      seoScore: null,
      bestPracticesScore: null,
      lcpMs: null,
      fcpMs: null,
      clsScore: null,
      tbtMs: null,
      speedIndexMs: null,
      inpMs: null,
      ttfbMs: null,
      failed: false,
      error: null,
    });

    // Wait a tick to ensure different timestamp ordering
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Insert newer report
    await insertLighthouseReport(db, 'latest-group', 'manual', {
      url: 'https://site.com/',
      performanceScore: 95,
      accessibilityScore: 100,
      seoScore: null,
      bestPracticesScore: null,
      lcpMs: null,
      fcpMs: null,
      clsScore: null,
      tbtMs: null,
      speedIndexMs: null,
      inpMs: null,
      ttfbMs: null,
      failed: false,
      error: null,
    });

    const results = await getGroupLighthouse(db, 'latest-group');
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://site.com/');
    // Should return the latest (performanceScore: 95, not 60)
    expect(results[0].latestReport?.performanceScore).toBe(95);
    expect(results[0].latestReport?.accessibilityScore).toBe(100);
    expect(results[0].latestReport?.triggeredBy).toBe('manual');
  });

  it('failed audit stores error information', async () => {
    const db = await createTestDb();
    const { insertLighthouseReport, getGroupLighthouse } = await import('./lighthouse');

    await insertLighthouseReport(db, 'error-group', 'manual', {
      url: 'https://broken.com/',
      performanceScore: null,
      accessibilityScore: null,
      seoScore: null,
      bestPracticesScore: null,
      lcpMs: null,
      fcpMs: null,
      clsScore: null,
      tbtMs: null,
      speedIndexMs: null,
      inpMs: null,
      ttfbMs: null,
      failed: true,
      error: 'Connection timeout',
    });

    const results = await getGroupLighthouse(db, 'error-group');
    expect(results).toHaveLength(1);
    expect(results[0].latestReport?.failed).toBe(true);
    expect(results[0].latestReport?.error).toBe('Connection timeout');
    expect(results[0].latestReport?.performanceScore).toBeNull();
  });
});
