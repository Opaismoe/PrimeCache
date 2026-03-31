import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { runs, visits } from '../db/schema';

vi.stubEnv('BROWSERLESS_WS_URL', 'ws://browserless:3000/chromium/playwright');
vi.stubEnv('BROWSERLESS_TOKEN', 'test-token');
vi.stubEnv('API_KEY', 'a-valid-api-key-at-least-16');

const BASE_OPTIONS = {
  scrollToBottom: false as const,
  crawl: false as const,
  navigationTimeout: 30_000,
  waitUntil: 'networkidle' as const,
  retryCount: 0,
};

vi.mock('./visitor', () => ({
  visitUrl: vi.fn().mockResolvedValue({
    url: 'https://example.com/',
    finalUrl: 'https://example.com/',
    statusCode: 200,
    ttfbMs: 80,
    loadTimeMs: 400,
    consentFound: true,
    consentStrategy: 'cookiebot',
    error: null,
    visitedAt: new Date(),
    discoveredLinks: [],
  }),
}));

vi.mock('../browser/stealth', () => ({
  randomDelay: vi.fn().mockResolvedValue(undefined),
}));

type Db = ReturnType<typeof drizzle<typeof schema>>;
let db: Db;

async function createTestDb(): Promise<Db> {
  const client = new PGlite();
  const instance = drizzle({ client, schema });
  await migrate(instance, { migrationsFolder: path.join(__dirname, '../db/migrations') });
  return instance;
}

describe('runGroup', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    db = await createTestDb();
  });

  it('returns a numeric runId', async () => {
    const { runGroup } = await import('./runner');
    const runId = await runGroup(db, {
      name: 'homepage',
      schedule: '* * * * *',
      urls: ['https://example.com/'],
      options: BASE_OPTIONS,
    });
    expect(typeof runId).toBe('number');
    expect(runId).toBeGreaterThan(0);
  });

  it('creates a run record in the DB', async () => {
    const { runGroup } = await import('./runner');
    const runId = await runGroup(db, {
      name: 'homepage',
      schedule: '* * * * *',
      urls: ['https://example.com/'],
      options: BASE_OPTIONS,
    });
    const [run] = await db.select().from(runs).where(eq(runs.id, runId));
    expect(run).toBeTruthy();
    expect(run.group_name).toBe('homepage');
    expect(run.ended_at).toBeTruthy();
  });

  it('sets status to completed when all visits succeed', async () => {
    const { runGroup } = await import('./runner');
    const runId = await runGroup(db, {
      name: 'homepage',
      schedule: '* * * * *',
      urls: ['https://a.com/', 'https://b.com/'],
      options: BASE_OPTIONS,
    });
    const [run] = await db.select().from(runs).where(eq(runs.id, runId));
    expect(run.status).toBe('completed');
    expect(run.success_count).toBe(2);
    expect(run.failure_count).toBe(0);
  });

  it('sets status to partial_failure when some visits fail', async () => {
    const { visitUrl } = await import('./visitor');
    vi.mocked(visitUrl)
      .mockResolvedValueOnce({
        url: 'https://a.com/',
        finalUrl: null,
        statusCode: 200,
        ttfbMs: 80,
        loadTimeMs: 400,
        consentFound: false,
        consentStrategy: null,
        error: null,
        visitedAt: new Date(),
        discoveredLinks: [],
      })
      .mockResolvedValueOnce({
        url: 'https://b.com/',
        finalUrl: null,
        statusCode: null,
        ttfbMs: null,
        loadTimeMs: 0,
        consentFound: false,
        consentStrategy: null,
        error: 'Timeout',
        visitedAt: new Date(),
        discoveredLinks: [],
      });

    const { runGroup } = await import('./runner');
    const runId = await runGroup(db, {
      name: 'homepage',
      schedule: '* * * * *',
      urls: ['https://a.com/', 'https://b.com/'],
      options: BASE_OPTIONS,
    });
    const [run] = await db.select().from(runs).where(eq(runs.id, runId));
    expect(run.status).toBe('partial_failure');
    expect(run.success_count).toBe(1);
    expect(run.failure_count).toBe(1);
  });

  it('sets status to failed when all visits fail', async () => {
    const { visitUrl } = await import('./visitor');
    vi.mocked(visitUrl).mockResolvedValue({
      url: 'https://fail.com/',
      finalUrl: null,
      statusCode: null,
      ttfbMs: null,
      loadTimeMs: 0,
      consentFound: false,
      consentStrategy: null,
      error: 'Timeout',
      visitedAt: new Date(),
      discoveredLinks: [],
    });

    const { runGroup } = await import('./runner');
    const runId = await runGroup(db, {
      name: 'homepage',
      schedule: '* * * * *',
      urls: ['https://fail.com/'],
      options: BASE_OPTIONS,
    });
    const [run] = await db.select().from(runs).where(eq(runs.id, runId));
    expect(run.status).toBe('failed');
  });

  it('inserts a visit record per URL', async () => {
    const { runGroup } = await import('./runner');
    const runId = await runGroup(db, {
      name: 'homepage',
      schedule: '* * * * *',
      urls: ['https://a.com/', 'https://b.com/'],
      options: BASE_OPTIONS,
    });
    const v = await db.select().from(visits).where(eq(visits.run_id, runId));
    expect(v).toHaveLength(2);
  });

  it('crawls discovered links up to crawl_depth', async () => {
    const { visitUrl } = await import('./visitor');
    vi.mocked(visitUrl).mockImplementation(async (url) => ({
      url,
      finalUrl: url,
      statusCode: 200,
      ttfbMs: 10,
      loadTimeMs: 100,
      consentFound: false,
      consentStrategy: null,
      error: null,
      visitedAt: new Date(),
      discoveredLinks:
        url === 'https://example.com/'
          ? ['https://example.com/about', 'https://example.com/contact']
          : [],
    }));

    const { runGroup } = await import('./runner');
    const runId = await runGroup(db, {
      name: 'crawl-group',
      schedule: '* * * * *',
      urls: ['https://example.com/'],
      options: { ...BASE_OPTIONS, crawl: true, crawl_depth: 1 },
    });

    const v = await db.select().from(visits).where(eq(visits.run_id, runId));
    expect(v).toHaveLength(3); // seed + 2 discovered
    const visitedUrls = v.map((r) => r.url);
    expect(visitedUrls).toContain('https://example.com/');
    expect(visitedUrls).toContain('https://example.com/about');
    expect(visitedUrls).toContain('https://example.com/contact');
  });

  it('does not visit the same URL twice during a crawl', async () => {
    const { visitUrl } = await import('./visitor');
    vi.mocked(visitUrl).mockResolvedValue({
      url: 'https://example.com/',
      finalUrl: 'https://example.com/',
      statusCode: 200,
      ttfbMs: 10,
      loadTimeMs: 100,
      consentFound: false,
      consentStrategy: null,
      error: null,
      visitedAt: new Date(),
      discoveredLinks: ['https://example.com/'],
    });

    const { runGroup } = await import('./runner');
    const runId = await runGroup(db, {
      name: 'dedup-group',
      schedule: '* * * * *',
      urls: ['https://example.com/'],
      options: { ...BASE_OPTIONS, crawl: true, crawl_depth: 2 },
    });

    const v = await db.select().from(visits).where(eq(visits.run_id, runId));
    expect(v).toHaveLength(1);
  });

  it('stops at crawl_depth and does not follow deeper links', async () => {
    const { visitUrl } = await import('./visitor');
    vi.mocked(visitUrl).mockImplementation(async (url) => ({
      url,
      finalUrl: url,
      statusCode: 200,
      ttfbMs: 10,
      loadTimeMs: 100,
      consentFound: false,
      consentStrategy: null,
      error: null,
      visitedAt: new Date(),
      discoveredLinks:
        url === 'https://example.com/'
          ? ['https://example.com/depth1']
          : url === 'https://example.com/depth1'
            ? ['https://example.com/depth2']
            : [],
    }));

    const { runGroup } = await import('./runner');
    const runId = await runGroup(db, {
      name: 'depth-group',
      schedule: '* * * * *',
      urls: ['https://example.com/'],
      options: { ...BASE_OPTIONS, crawl: true, crawl_depth: 1 },
    });

    const v = await db.select().from(visits).where(eq(visits.run_id, runId));
    expect(v).toHaveLength(2);
    const urls = v.map((r) => r.url);
    expect(urls).not.toContain('https://example.com/depth2');
  });

  describe('retries', () => {
    it('counts a visit as success when a retry succeeds after initial failure', async () => {
      const { visitUrl } = await import('./visitor');
      vi.mocked(visitUrl)
        .mockResolvedValueOnce({
          url: 'https://a.com/',
          finalUrl: null,
          statusCode: null,
          ttfbMs: null,
          loadTimeMs: 0,
          consentFound: false,
          consentStrategy: null,
          error: 'Timeout',
          visitedAt: new Date(),
          discoveredLinks: [],
        })
        .mockResolvedValueOnce({
          url: 'https://a.com/',
          finalUrl: 'https://a.com/',
          statusCode: 200,
          ttfbMs: 80,
          loadTimeMs: 400,
          consentFound: false,
          consentStrategy: null,
          error: null,
          visitedAt: new Date(),
          discoveredLinks: [],
        });

      const { runGroup } = await import('./runner');
      const runId = await runGroup(db, {
        name: 'retry-success',
        schedule: '* * * * *',
        urls: ['https://a.com/'],
        options: { ...BASE_OPTIONS, retryCount: 2 },
      });
      const [run] = await db.select().from(runs).where(eq(runs.id, runId));
      expect(run.status).toBe('completed');
      expect(run.success_count).toBe(1);
      expect(run.failure_count).toBe(0);
      expect(vi.mocked(visitUrl)).toHaveBeenCalledTimes(2);
    });

    it('counts as failed when all retries are exhausted', async () => {
      const { visitUrl } = await import('./visitor');
      vi.mocked(visitUrl).mockResolvedValue({
        url: 'https://a.com/',
        finalUrl: null,
        statusCode: null,
        ttfbMs: null,
        loadTimeMs: 0,
        consentFound: false,
        consentStrategy: null,
        error: 'Timeout',
        visitedAt: new Date(),
        discoveredLinks: [],
      });

      const { runGroup } = await import('./runner');
      const runId = await runGroup(db, {
        name: 'retry-fail',
        schedule: '* * * * *',
        urls: ['https://a.com/'],
        options: { ...BASE_OPTIONS, retryCount: 2 },
      });
      const [run] = await db.select().from(runs).where(eq(runs.id, runId));
      expect(run.status).toBe('failed');
      expect(run.failure_count).toBe(1);
      // 1 initial attempt + 2 retries = 3 calls
      expect(vi.mocked(visitUrl)).toHaveBeenCalledTimes(3);
    });

    it('inserts only one visit record after retries', async () => {
      const { visitUrl } = await import('./visitor');
      vi.mocked(visitUrl)
        .mockResolvedValueOnce({
          url: 'https://a.com/',
          finalUrl: null,
          statusCode: null,
          ttfbMs: null,
          loadTimeMs: 0,
          consentFound: false,
          consentStrategy: null,
          error: 'Timeout',
          visitedAt: new Date(),
          discoveredLinks: [],
        })
        .mockResolvedValueOnce({
          url: 'https://a.com/',
          finalUrl: 'https://a.com/',
          statusCode: 200,
          ttfbMs: 80,
          loadTimeMs: 400,
          consentFound: false,
          consentStrategy: null,
          error: null,
          visitedAt: new Date(),
          discoveredLinks: [],
        });

      const { runGroup } = await import('./runner');
      const runId = await runGroup(db, {
        name: 'retry-one-record',
        schedule: '* * * * *',
        urls: ['https://a.com/'],
        options: { ...BASE_OPTIONS, retryCount: 2 },
      });
      const v = await db.select().from(visits).where(eq(visits.run_id, runId));
      expect(v).toHaveLength(1);
    });

    it('persists retry_count = 0 when visitUrl succeeds on first attempt', async () => {
      const { visitUrl } = await import('./visitor');
      vi.mocked(visitUrl).mockResolvedValue({
        url: 'https://example.com/',
        finalUrl: 'https://example.com/',
        statusCode: 200,
        ttfbMs: 50,
        loadTimeMs: 300,
        consentFound: false,
        consentStrategy: null,
        error: null,
        visitedAt: new Date(),
        discoveredLinks: [],
      });
      const { runGroup } = await import('./runner');
      const runId = await runGroup(db, {
        name: 'retry-count-zero',
        schedule: '* * * * *',
        urls: ['https://example.com/'],
        options: { ...BASE_OPTIONS, retryCount: 3 },
      });
      const [v] = await db.select().from(visits).where(eq(visits.run_id, runId));
      expect(v.retry_count).toBe(0);
    });

    it('persists retry_count = 1 when visitUrl fails once then succeeds', async () => {
      const { visitUrl } = await import('./visitor');
      vi.mocked(visitUrl)
        .mockResolvedValueOnce({
          url: 'https://a.com/',
          finalUrl: null,
          statusCode: null,
          ttfbMs: null,
          loadTimeMs: 0,
          consentFound: false,
          consentStrategy: null,
          error: 'Timeout',
          visitedAt: new Date(),
          discoveredLinks: [],
        })
        .mockResolvedValueOnce({
          url: 'https://a.com/',
          finalUrl: 'https://a.com/',
          statusCode: 200,
          ttfbMs: 80,
          loadTimeMs: 400,
          consentFound: false,
          consentStrategy: null,
          error: null,
          visitedAt: new Date(),
          discoveredLinks: [],
        });

      const { runGroup } = await import('./runner');
      const runId = await runGroup(db, {
        name: 'retry-count-one',
        schedule: '* * * * *',
        urls: ['https://a.com/'],
        options: { ...BASE_OPTIONS, retryCount: 3 },
      });
      const [v] = await db.select().from(visits).where(eq(visits.run_id, runId));
      expect(v.retry_count).toBe(1);
    });

    it('persists retry_count = maxRetries when all attempts fail', async () => {
      const { visitUrl } = await import('./visitor');
      vi.mocked(visitUrl).mockResolvedValue({
        url: 'https://a.com/',
        finalUrl: null,
        statusCode: null,
        ttfbMs: null,
        loadTimeMs: 0,
        consentFound: false,
        consentStrategy: null,
        error: 'Timeout',
        visitedAt: new Date(),
        discoveredLinks: [],
      });

      const { runGroup } = await import('./runner');
      const runId = await runGroup(db, {
        name: 'retry-count-max',
        schedule: '* * * * *',
        urls: ['https://a.com/'],
        options: { ...BASE_OPTIONS, retryCount: 2 },
      });
      const [v] = await db.select().from(visits).where(eq(visits.run_id, runId));
      expect(v.retry_count).toBe(2);
    });
  });

  describe('run timeout', () => {
    it('auto-cancels a run that exceeds the 60-minute timeout', async () => {
      vi.useFakeTimers();

      const { visitUrl } = await import('./visitor');
      vi.mocked(visitUrl).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  url: 'https://example.com/',
                  finalUrl: 'https://example.com/',
                  statusCode: 200,
                  ttfbMs: 100,
                  loadTimeMs: 1000,
                  consentFound: false,
                  consentStrategy: null,
                  error: null,
                  visitedAt: new Date(),
                  discoveredLinks: [],
                }),
              61 * 60 * 1000,
            ),
          ),
      );

      const { runGroup } = await import('./runner');
      const runPromise = runGroup(db, {
        name: 'slow-group',
        schedule: '* * * * *',
        urls: ['https://example.com/'],
        options: BASE_OPTIONS,
      });

      await vi.advanceTimersByTimeAsync(62 * 60 * 1000);

      const runId = await runPromise;
      const [run] = await db.select().from(runs).where(eq(runs.id, runId));
      expect(run.status).toBe('cancelled');

      vi.useRealTimers();
    });
  });
});
