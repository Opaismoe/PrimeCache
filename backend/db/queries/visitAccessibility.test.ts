import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { describe, expect, it } from 'vitest'
import * as schema from '../schema'
import { runs, visits } from '../schema'

async function createTestDb() {
  const client = new PGlite()
  const db = drizzle({ client, schema })
  await migrate(db, { migrationsFolder: path.join(__dirname, '../migrations') })
  return db
}

describe('visitAccessibility queries', () => {
  it('insertVisitAccessibility and getAccessibilityByVisitId round-trip', async () => {
    const db = await createTestDb()
    const { insertVisitAccessibility, getAccessibilityByVisitId } = await import('./visitAccessibility')
    // insert run + visit first
    const [run] = await db.insert(runs).values({ group_name: 'a11y-test', started_at: new Date(), status: 'completed' }).returning()
    const [visit] = await db.insert(visits).values({ run_id: run.id, url: 'https://x.com/', load_time_ms: 100, visited_at: new Date(), error: null }).returning()

    await insertVisitAccessibility(db, visit.id, {
      violationCount: 2, criticalCount: 1, seriousCount: 1,
      violations: [{ id: 'btn', impact: 'critical', help: 'Buttons need text', description: 'desc', helpUrl: 'https://deque.com', nodeCount: 1 }],
      collectedAt: new Date(),
    })
    const result = await getAccessibilityByVisitId(db, visit.id)
    expect(result).not.toBeNull()
    expect(result!.violationCount).toBe(2)
    expect(result!.violations[0].id).toBe('btn')
  })

  it('getGroupAccessibility returns per-URL summary', async () => {
    const db = await createTestDb()
    const { insertVisitAccessibility, getGroupAccessibility } = await import('./visitAccessibility')
    const [run] = await db.insert(runs).values({ group_name: 'a11y-group', started_at: new Date(), status: 'completed' }).returning()
    const [visit] = await db.insert(visits).values({ run_id: run.id, url: 'https://y.com/', load_time_ms: 200, visited_at: new Date(), error: null }).returning()
    await insertVisitAccessibility(db, visit.id, {
      violationCount: 3, criticalCount: 2, seriousCount: 1,
      violations: [
        { id: 'color', impact: 'serious', help: 'Color contrast', description: 'desc', helpUrl: 'https://deque.com/color', nodeCount: 4 },
        { id: 'btn', impact: 'critical', help: 'Button text', description: 'desc', helpUrl: 'https://deque.com/btn', nodeCount: 1 },
      ],
      collectedAt: new Date(),
    })
    const result = await getGroupAccessibility(db, 'a11y-group')
    expect(result.urls).toHaveLength(1)
    expect(result.urls[0].url).toBe('https://y.com/')
    expect(result.urls[0].latestViolationCount).toBe(3)
    expect(result.urls[0].topViolations.length).toBeGreaterThan(0)
  })
})
