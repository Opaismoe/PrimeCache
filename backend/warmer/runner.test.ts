import { describe, it, expect, vi, beforeEach } from 'vitest'
import knex, { type Knex } from 'knex'
import path from 'path'

vi.stubEnv('BROWSERLESS_WS_URL', 'ws://browserless:3000/chromium/playwright')
vi.stubEnv('BROWSERLESS_TOKEN', 'test-token')
vi.stubEnv('API_KEY', 'a-valid-api-key-at-least-16')

const BASE_OPTIONS = {
  scrollToBottom: false as const,
  crawl: false as const,
  navigationTimeout: 30_000,
  waitUntil: 'networkidle' as const,
}

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
}))

vi.mock('../browser/stealth', () => ({
  randomDelay: vi.fn().mockResolvedValue(undefined),
}))

let db: Knex

async function createTestDb() {
  const instance = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true })
  await instance.migrate.latest({ directory: path.join(__dirname, '../db/migrations') })
  return instance
}

describe('runGroup', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    db = await createTestDb()
  })

  it('returns a numeric runId', async () => {
    const { runGroup } = await import('./runner')
    const runId = await runGroup(db, { name: 'homepage', schedule: '* * * * *', urls: ['https://example.com/'], options: BASE_OPTIONS })
    expect(typeof runId).toBe('number')
    expect(runId).toBeGreaterThan(0)
  })

  it('creates a run record in the DB', async () => {
    const { runGroup } = await import('./runner')
    const runId = await runGroup(db, { name: 'homepage', schedule: '* * * * *', urls: ['https://example.com/'], options: BASE_OPTIONS })
    const run = await db('runs').where({ id: runId }).first()
    expect(run).toBeTruthy()
    expect(run.group_name).toBe('homepage')
    expect(run.ended_at).toBeTruthy()
  })

  it('sets status to completed when all visits succeed', async () => {
    const { runGroup } = await import('./runner')
    const runId = await runGroup(db, { name: 'homepage', schedule: '* * * * *', urls: ['https://a.com/', 'https://b.com/'], options: BASE_OPTIONS })
    const run = await db('runs').where({ id: runId }).first()
    expect(run.status).toBe('completed')
    expect(run.success_count).toBe(2)
    expect(run.failure_count).toBe(0)
  })

  it('sets status to partial_failure when some visits fail', async () => {
    const { visitUrl } = await import('./visitor')
    vi.mocked(visitUrl)
      .mockResolvedValueOnce({ url: 'https://a.com/', finalUrl: null, statusCode: 200, ttfbMs: 80, loadTimeMs: 400, consentFound: false, consentStrategy: null, error: null, visitedAt: new Date(), discoveredLinks: [] })
      .mockResolvedValueOnce({ url: 'https://b.com/', finalUrl: null, statusCode: null, ttfbMs: null, loadTimeMs: 0, consentFound: false, consentStrategy: null, error: 'Timeout', visitedAt: new Date(), discoveredLinks: [] })

    const { runGroup } = await import('./runner')
    const runId = await runGroup(db, { name: 'homepage', schedule: '* * * * *', urls: ['https://a.com/', 'https://b.com/'], options: BASE_OPTIONS })
    const run = await db('runs').where({ id: runId }).first()
    expect(run.status).toBe('partial_failure')
    expect(run.success_count).toBe(1)
    expect(run.failure_count).toBe(1)
  })

  it('sets status to failed when all visits fail', async () => {
    const { visitUrl } = await import('./visitor')
    vi.mocked(visitUrl).mockResolvedValue({ url: 'https://fail.com/', finalUrl: null, statusCode: null, ttfbMs: null, loadTimeMs: 0, consentFound: false, consentStrategy: null, error: 'Timeout', visitedAt: new Date(), discoveredLinks: [] })

    const { runGroup } = await import('./runner')
    const runId = await runGroup(db, { name: 'homepage', schedule: '* * * * *', urls: ['https://fail.com/'], options: BASE_OPTIONS })
    const run = await db('runs').where({ id: runId }).first()
    expect(run.status).toBe('failed')
  })

  it('inserts a visit record per URL', async () => {
    const { runGroup } = await import('./runner')
    const runId = await runGroup(db, { name: 'homepage', schedule: '* * * * *', urls: ['https://a.com/', 'https://b.com/'], options: BASE_OPTIONS })
    const visits = await db('visits').where({ run_id: runId })
    expect(visits).toHaveLength(2)
  })

  it('crawls discovered links up to crawl_depth', async () => {
    const { visitUrl } = await import('./visitor')
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
      discoveredLinks: url === 'https://example.com/'
        ? ['https://example.com/about', 'https://example.com/contact']
        : [],
    }))

    const { runGroup } = await import('./runner')
    const runId = await runGroup(db, {
      name: 'crawl-group',
      schedule: '* * * * *',
      urls: ['https://example.com/'],
      options: { ...BASE_OPTIONS, crawl: true, crawl_depth: 1 },
    })

    const visits = await db('visits').where({ run_id: runId })
    expect(visits).toHaveLength(3) // seed + 2 discovered
    const visitedUrls = visits.map((v: any) => v.url)
    expect(visitedUrls).toContain('https://example.com/')
    expect(visitedUrls).toContain('https://example.com/about')
    expect(visitedUrls).toContain('https://example.com/contact')
  })

  it('does not visit the same URL twice during a crawl', async () => {
    const { visitUrl } = await import('./visitor')
    // Seed returns a link that points back to itself
    vi.mocked(visitUrl).mockResolvedValue({
      url: 'https://example.com/', finalUrl: 'https://example.com/', statusCode: 200, ttfbMs: 10, loadTimeMs: 100,
      consentFound: false, consentStrategy: null, error: null, visitedAt: new Date(),
      discoveredLinks: ['https://example.com/'],  // circular
    })

    const { runGroup } = await import('./runner')
    const runId = await runGroup(db, {
      name: 'dedup-group',
      schedule: '* * * * *',
      urls: ['https://example.com/'],
      options: { ...BASE_OPTIONS, crawl: true, crawl_depth: 2 },
    })

    const visits = await db('visits').where({ run_id: runId })
    expect(visits).toHaveLength(1)
  })

  it('stops at crawl_depth and does not follow deeper links', async () => {
    const { visitUrl } = await import('./visitor')
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
        url === 'https://example.com/'      ? ['https://example.com/depth1'] :
        url === 'https://example.com/depth1' ? ['https://example.com/depth2'] :
        [],
    }))

    const { runGroup } = await import('./runner')
    const runId = await runGroup(db, {
      name: 'depth-group',
      schedule: '* * * * *',
      urls: ['https://example.com/'],
      options: { ...BASE_OPTIONS, crawl: true, crawl_depth: 1 },
    })

    const visits = await db('visits').where({ run_id: runId })
    // depth 0 (seed) + depth 1 = 2 pages, depth2 not visited
    expect(visits).toHaveLength(2)
    const urls = visits.map((v: any) => v.url)
    expect(urls).not.toContain('https://example.com/depth2')
  })

  describe('run timeout', () => {
    it('auto-cancels a run that exceeds the 60-minute timeout', async () => {
      vi.useFakeTimers()

      const { visitUrl } = await import('./visitor')
      // Make visitUrl hang for 61 minutes (longer than the 60-min timeout)
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
      )

      const { runGroup } = await import('./runner')
      const runPromise = runGroup(db, {
        name: 'slow-group',
        schedule: '* * * * *',
        urls: ['https://example.com/'],
        options: BASE_OPTIONS,
      })

      // Advance past the 60-min timeout (fires cancel) and past visitUrl's 61-min delay
      await vi.advanceTimersByTimeAsync(62 * 60 * 1000)

      const runId = await runPromise
      const run = await db('runs').where({ id: runId }).first()
      expect(run.status).toBe('cancelled')

      vi.useRealTimers()
    })
  })
})
