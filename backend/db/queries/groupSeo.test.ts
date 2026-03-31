import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { describe, expect, it } from 'vitest'
import * as schema from '../schema'
import { runs, visit_seo, visits } from '../schema'

async function createTestDb() {
  const client = new PGlite()
  const db = drizzle({ client, schema })
  await migrate(db, { migrationsFolder: path.join(__dirname, '../migrations') })
  return db
}

describe('getGroupSeo — cancelled run exclusion', () => {
  it('excludes SEO data from cancelled runs', async () => {
    const db = await createTestDb()
    const { getGroupSeo } = await import('./groupSeo')

    const [completed] = await db.insert(runs).values({
      group_name: 'seo-cancel-test',
      started_at: new Date('2025-01-01T10:00:00Z'),
      status: 'completed',
    }).returning()
    const [v1] = await db.insert(visits).values({
      run_id: completed.id, url: 'https://example.com/',
      load_time_ms: 500, visited_at: new Date('2025-01-01T10:01:00Z'), error: null,
    }).returning()
    await db.insert(visit_seo).values({
      visit_id: v1.id,
      title: 'Good Title Here',
      meta_description: 'A good meta description that is long enough to score well on this page',
      h1: 'Main Heading', canonical_url: 'https://example.com/',
      og_title: 'OG Title', og_description: 'OG Desc',
      og_image: null, robots_meta: null,
      collected_at: new Date('2025-01-01T10:01:00Z'),
    })

    // Cancelled run AFTER completed — with empty SEO (simulates mid-run cancel)
    const [cancelled] = await db.insert(runs).values({
      group_name: 'seo-cancel-test',
      started_at: new Date('2025-01-02T10:00:00Z'),
      status: 'cancelled',
    }).returning()
    const [v2] = await db.insert(visits).values({
      run_id: cancelled.id, url: 'https://example.com/',
      load_time_ms: 200, visited_at: new Date('2025-01-02T10:01:00Z'), error: null,
    }).returning()
    await db.insert(visit_seo).values({
      visit_id: v2.id, title: null, meta_description: null, h1: null,
      canonical_url: null, og_title: null, og_description: null,
      og_image: null, robots_meta: null,
      collected_at: new Date('2025-01-02T10:01:00Z'),
    })

    const result = await getGroupSeo(db, 'seo-cancel-test')
    expect(result.urls).toHaveLength(1)
    // Must show completed run's data, not cancelled run's empty data
    expect(result.urls[0].latestSeo?.title).toBe('Good Title Here')
    // Must NOT be marked changed (cancelled run must not count as a baseline)
    expect(result.urls[0].changed).toBe(false)
  })
})
