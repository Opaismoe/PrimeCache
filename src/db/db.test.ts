import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import knex, { type Knex } from 'knex'
import path from 'path'

// In-memory SQLite for all DB tests
let db: Knex

async function createTestDb(): Promise<Knex> {
  const instance = knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
  })
  await instance.migrate.latest({
    directory: path.join(__dirname, 'migrations'),
  })
  return instance
}

// --- runs queries ---
describe('runs queries', () => {
  beforeEach(async () => {
    db = await createTestDb()
  })

  afterAll(async () => {
    await db.destroy()
  })

  it('insertRun returns a numeric id', async () => {
    const { insertRun } = await import('./queries/runs')
    const id = await insertRun(db, { groupName: 'homepage', totalUrls: 2 })
    expect(typeof id).toBe('number')
    expect(id).toBeGreaterThan(0)
  })

  it('insertRun sets status to "running" and records started_at', async () => {
    const { insertRun } = await import('./queries/runs')
    const id = await insertRun(db, { groupName: 'homepage', totalUrls: 2 })
    const row = await db('runs').where({ id }).first()
    expect(row.status).toBe('running')
    expect(row.started_at).toBeTruthy()
    expect(row.ended_at).toBeNull()
  })

  it('finalizeRun updates status, ended_at, and counts', async () => {
    const { insertRun, finalizeRun } = await import('./queries/runs')
    const id = await insertRun(db, { groupName: 'homepage', totalUrls: 3 })
    await finalizeRun(db, id, { status: 'partial_failure', successCount: 2, failureCount: 1 })
    const row = await db('runs').where({ id }).first()
    expect(row.status).toBe('partial_failure')
    expect(row.ended_at).toBeTruthy()
    expect(row.success_count).toBe(2)
    expect(row.failure_count).toBe(1)
  })

  it('getRuns returns rows newest first', async () => {
    const { insertRun, getRuns } = await import('./queries/runs')
    const id1 = await insertRun(db, { groupName: 'a', totalUrls: 1 })
    const id2 = await insertRun(db, { groupName: 'b', totalUrls: 1 })
    const rows = await getRuns(db, { limit: 10, offset: 0 })
    expect(rows[0].id).toBe(id2)
    expect(rows[1].id).toBe(id1)
  })

  it('getRunById returns null for unknown id', async () => {
    const { getRunById } = await import('./queries/runs')
    const row = await getRunById(db, 99999)
    expect(row).toBeNull()
  })

  it('getLatestPerGroup returns one row per group', async () => {
    const { insertRun, getLatestPerGroup } = await import('./queries/runs')
    await insertRun(db, { groupName: 'homepage', totalUrls: 1 })
    await insertRun(db, { groupName: 'homepage', totalUrls: 1 })
    await insertRun(db, { groupName: 'products', totalUrls: 1 })
    const rows = await getLatestPerGroup(db)
    expect(rows).toHaveLength(2)
    expect(rows.map((r: { group_name: string }) => r.group_name).sort()).toEqual(['homepage', 'products'])
  })
})

// --- visits queries ---
describe('visits queries', () => {
  beforeEach(async () => {
    db = await createTestDb()
  })

  afterAll(async () => {
    await db.destroy()
  })

  it('insertVisits bulk inserts and returns count', async () => {
    const { insertRun } = await import('./queries/runs')
    const { insertVisits } = await import('./queries/visits')

    const runId = await insertRun(db, { groupName: 'homepage', totalUrls: 2 })
    const count = await insertVisits(db, runId, [
      { url: 'https://a.com', statusCode: 200, finalUrl: 'https://a.com', ttfbMs: 100, loadTimeMs: 500, consentFound: true, consentStrategy: 'cookiebot', error: null },
      { url: 'https://b.com', statusCode: null, finalUrl: null, ttfbMs: null, loadTimeMs: 300, consentFound: false, consentStrategy: null, error: 'Timeout' },
    ])
    expect(count).toBe(2)
  })

  it('getVisitsByRunId returns all visits for a run', async () => {
    const { insertRun } = await import('./queries/runs')
    const { insertVisits, getVisitsByRunId } = await import('./queries/visits')

    const runId = await insertRun(db, { groupName: 'homepage', totalUrls: 1 })
    await insertVisits(db, runId, [
      { url: 'https://a.com', statusCode: 200, finalUrl: 'https://a.com', ttfbMs: 80, loadTimeMs: 400, consentFound: false, consentStrategy: null, error: null },
    ])
    const visits = await getVisitsByRunId(db, runId)
    expect(visits).toHaveLength(1)
    expect(visits[0].url).toBe('https://a.com')
    expect(visits[0].ttfb_ms).toBe(80)
    expect(visits[0].error).toBeNull()
  })

  it('persists error field correctly', async () => {
    const { insertRun } = await import('./queries/runs')
    const { insertVisits, getVisitsByRunId } = await import('./queries/visits')

    const runId = await insertRun(db, { groupName: 'homepage', totalUrls: 1 })
    await insertVisits(db, runId, [
      { url: 'https://fail.com', statusCode: null, finalUrl: null, ttfbMs: null, loadTimeMs: 0, consentFound: false, consentStrategy: null, error: 'Navigation timeout' },
    ])
    const visits = await getVisitsByRunId(db, runId)
    expect(visits[0].error).toBe('Navigation timeout')
  })

  it('insertVisit inserts a single visit and returns the row id', async () => {
    const { insertRun } = await import('./queries/runs')
    const { insertVisit, getVisitsByRunId } = await import('./queries/visits')

    const runId = await insertRun(db, { groupName: 'homepage', totalUrls: 1 })
    const visitId = await insertVisit(db, runId, {
      url: 'https://single.com', statusCode: 200, finalUrl: 'https://single.com',
      ttfbMs: 50, loadTimeMs: 300, consentFound: false, consentStrategy: null, error: null,
    })
    expect(typeof visitId).toBe('number')
    expect(visitId).toBeGreaterThan(0)
    const visits = await getVisitsByRunId(db, runId)
    expect(visits).toHaveLength(1)
    expect(visits[0].url).toBe('https://single.com')
  })
})
