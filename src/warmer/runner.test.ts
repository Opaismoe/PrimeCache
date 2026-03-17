import { describe, it, expect, vi, beforeEach } from 'vitest'
import knex, { type Knex } from 'knex'
import path from 'path'

vi.stubEnv('BROWSERLESS_WS_URL', 'ws://browserless:3000/chromium/playwright')
vi.stubEnv('BROWSERLESS_TOKEN', 'test-token')
vi.stubEnv('API_KEY', 'a-valid-api-key-at-least-16')

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
    const runId = await runGroup(db, { name: 'homepage', schedule: '* * * * *', urls: ['https://example.com/'], options: { scrollToBottom: false } })
    expect(typeof runId).toBe('number')
    expect(runId).toBeGreaterThan(0)
  })

  it('creates a run record in the DB', async () => {
    const { runGroup } = await import('./runner')
    const runId = await runGroup(db, { name: 'homepage', schedule: '* * * * *', urls: ['https://example.com/'], options: { scrollToBottom: false } })
    const run = await db('runs').where({ id: runId }).first()
    expect(run).toBeTruthy()
    expect(run.group_name).toBe('homepage')
    expect(run.ended_at).toBeTruthy()
  })

  it('sets status to completed when all visits succeed', async () => {
    const { runGroup } = await import('./runner')
    const runId = await runGroup(db, { name: 'homepage', schedule: '* * * * *', urls: ['https://a.com/', 'https://b.com/'], options: { scrollToBottom: false } })
    const run = await db('runs').where({ id: runId }).first()
    expect(run.status).toBe('completed')
    expect(run.success_count).toBe(2)
    expect(run.failure_count).toBe(0)
  })

  it('sets status to partial_failure when some visits fail', async () => {
    const { visitUrl } = await import('./visitor')
    vi.mocked(visitUrl)
      .mockResolvedValueOnce({ url: 'https://a.com/', finalUrl: null, statusCode: 200, ttfbMs: 80, loadTimeMs: 400, consentFound: false, consentStrategy: null, error: null, visitedAt: new Date() })
      .mockResolvedValueOnce({ url: 'https://b.com/', finalUrl: null, statusCode: null, ttfbMs: null, loadTimeMs: 0, consentFound: false, consentStrategy: null, error: 'Timeout', visitedAt: new Date() })

    const { runGroup } = await import('./runner')
    const runId = await runGroup(db, { name: 'homepage', schedule: '* * * * *', urls: ['https://a.com/', 'https://b.com/'], options: { scrollToBottom: false } })
    const run = await db('runs').where({ id: runId }).first()
    expect(run.status).toBe('partial_failure')
    expect(run.success_count).toBe(1)
    expect(run.failure_count).toBe(1)
  })

  it('sets status to failed when all visits fail', async () => {
    const { visitUrl } = await import('./visitor')
    vi.mocked(visitUrl).mockResolvedValue({ url: 'https://fail.com/', finalUrl: null, statusCode: null, ttfbMs: null, loadTimeMs: 0, consentFound: false, consentStrategy: null, error: 'Timeout', visitedAt: new Date() })

    const { runGroup } = await import('./runner')
    const runId = await runGroup(db, { name: 'homepage', schedule: '* * * * *', urls: ['https://fail.com/'], options: { scrollToBottom: false } })
    const run = await db('runs').where({ id: runId }).first()
    expect(run.status).toBe('failed')
  })

  it('inserts a visit record per URL', async () => {
    const { runGroup } = await import('./runner')
    const runId = await runGroup(db, { name: 'homepage', schedule: '* * * * *', urls: ['https://a.com/', 'https://b.com/'], options: { scrollToBottom: false } })
    const visits = await db('visits').where({ run_id: runId })
    expect(visits).toHaveLength(2)
  })
})
