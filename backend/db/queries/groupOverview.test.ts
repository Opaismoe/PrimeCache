import { describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import path from 'path'
import * as schema from '../schema'
import { runs, visits, visit_seo } from '../schema'

async function createTestDb() {
  const client = new PGlite()
  const db = drizzle({ client, schema })
  await migrate(db, { migrationsFolder: path.join(__dirname, '../migrations') })
  return db
}

describe('getGroupOverview series', () => {
  it('series includes uptimePct: 100 when all visits succeed', async () => {
    const db = await createTestDb()
    const { getGroupOverview } = await import('./groupOverview')

    const [run] = await db.insert(runs).values({
      group_name: 'g1',
      started_at: new Date('2025-03-01T10:00:00Z'),
      status: 'completed',
      total_urls: 2,
      success_count: 2,
    }).returning()

    await db.insert(visits).values([
      { run_id: run.id, url: 'https://a.com/', load_time_ms: 400, visited_at: new Date('2025-03-01T10:01:00Z'), error: null },
      { run_id: run.id, url: 'https://a.com/p', load_time_ms: 500, visited_at: new Date('2025-03-01T10:02:00Z'), error: null },
    ])

    const result = await getGroupOverview(db, 'g1')
    expect(result.series).toHaveLength(1)
    expect(result.series[0].uptimePct).toBe(100)
  })

  it('series includes uptimePct: 50 when half of visits fail', async () => {
    const db = await createTestDb()
    const { getGroupOverview } = await import('./groupOverview')

    const [run] = await db.insert(runs).values({
      group_name: 'g2',
      started_at: new Date('2025-03-02T10:00:00Z'),
      status: 'partial_failure',
      total_urls: 2,
      success_count: 1,
      failure_count: 1,
    }).returning()

    await db.insert(visits).values([
      { run_id: run.id, url: 'https://b.com/', load_time_ms: 400, visited_at: new Date('2025-03-02T10:01:00Z'), error: null },
      { run_id: run.id, url: 'https://b.com/p', load_time_ms: 500, visited_at: new Date('2025-03-02T10:02:00Z'), error: 'timeout' },
    ])

    const result = await getGroupOverview(db, 'g2')
    expect(result.series[0].uptimePct).toBeCloseTo(50, 0)
  })

  it('series includes avgSeoScore when visit_seo data exists', async () => {
    const db = await createTestDb()
    const { getGroupOverview } = await import('./groupOverview')

    const [run] = await db.insert(runs).values({
      group_name: 'g3',
      started_at: new Date('2025-03-03T10:00:00Z'),
      status: 'completed',
      total_urls: 1,
      success_count: 1,
    }).returning()

    const [visit] = await db.insert(visits).values({
      run_id: run.id,
      url: 'https://c.com/',
      load_time_ms: 300,
      visited_at: new Date('2025-03-03T10:01:00Z'),
      error: null,
    }).returning()

    // Perfect SEO: all fields set with correct lengths
    await db.insert(visit_seo).values({
      visit_id: visit.id,
      title: 'Perfect Page Title Here',          // 10-60 chars → 20pts
      meta_description: 'A perfectly crafted meta description that is between fifty and one hundred sixty characters long here.',  // 50-160 → 20pts
      h1: 'Main Heading',                          // present → 20pts
      canonical_url: 'https://c.com/',             // present → 15pts
      og_title: 'OG Title',                        // both → 15pts
      og_description: 'OG Description',
      robots_meta: null,                           // no noindex → 10pts
      collected_at: new Date('2025-03-03T10:01:00Z'),
    })

    const result = await getGroupOverview(db, 'g3')
    expect(result.series[0].avgSeoScore).toBe(100)
  })

  it('series avgSeoScore is null when no SEO data', async () => {
    const db = await createTestDb()
    const { getGroupOverview } = await import('./groupOverview')

    const [run] = await db.insert(runs).values({
      group_name: 'g4',
      started_at: new Date('2025-03-04T10:00:00Z'),
      status: 'completed',
      total_urls: 1,
      success_count: 1,
    }).returning()

    await db.insert(visits).values({
      run_id: run.id,
      url: 'https://d.com/',
      load_time_ms: 300,
      visited_at: new Date('2025-03-04T10:01:00Z'),
      error: null,
    })

    const result = await getGroupOverview(db, 'g4')
    expect(result.series[0].avgSeoScore).toBeNull()
  })
})
