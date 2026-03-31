import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { describe, expect, it } from 'vitest'
import * as schema from '../schema'
import { runs, visit_broken_links, visits } from '../schema'

async function createTestDb() {
  const client = new PGlite()
  const db = drizzle({ client, schema })
  await migrate(db, { migrationsFolder: path.join(__dirname, '../migrations') })
  return db
}

describe('getGroupBrokenLinks — cancelled run exclusion', () => {
  it('excludes broken links from cancelled runs', async () => {
    const db = await createTestDb()
    const { getGroupBrokenLinks } = await import('./visitBrokenLinks')

    const [completed] = await db.insert(runs).values({
      group_name: 'links-cancel', started_at: new Date('2025-01-01T10:00:00Z'), status: 'completed',
    }).returning()
    await db.insert(visits).values({
      run_id: completed.id, url: 'https://e.com/', load_time_ms: 300,
      visited_at: new Date('2025-01-01T10:01:00Z'), error: null,
    })

    const [cancelled] = await db.insert(runs).values({
      group_name: 'links-cancel', started_at: new Date('2025-01-02T10:00:00Z'), status: 'cancelled',
    }).returning()
    const [v2] = await db.insert(visits).values({
      run_id: cancelled.id, url: 'https://e.com/', load_time_ms: 100,
      visited_at: new Date('2025-01-02T10:01:00Z'), error: null,
    }).returning()
    await db.insert(visit_broken_links).values({
      visit_id: v2.id, url: 'https://e.com/dead-link', status_code: 404, error: null,
    })

    const result = await getGroupBrokenLinks(db, 'links-cancel')
    expect(result).toHaveLength(0)
  })
})
