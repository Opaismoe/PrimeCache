import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../schema';
import { runs, visits } from '../schema';
import { getStats } from './stats';

type Db = ReturnType<typeof drizzle<typeof schema>>;
let db: Db;

const DAY = 86_400_000;

async function seedVisit(group: string, strategy: string | null, daysAgo: number) {
  const [run] = await db
    .insert(runs)
    .values({ group_name: group, status: 'completed', started_at: new Date() })
    .returning({ id: runs.id });
  await db.insert(visits).values({
    run_id: run.id,
    url: 'https://example.com/',
    load_time_ms: 100,
    consent_found: strategy !== null,
    consent_strategy: strategy,
    visited_at: new Date(Date.now() - daysAgo * DAY),
  });
}

describe('getStats — consent strategy telemetry', () => {
  beforeEach(async () => {
    const client = new PGlite();
    db = drizzle({ client, schema });
    await migrate(db, { migrationsFolder: path.join(__dirname, '../migrations') });
  });

  it('counts visits per group and consent strategy for the last 7 days and the 7 before', async () => {
    await seedVisit('shop', 'cookiebot', 1);
    await seedVisit('shop', 'cookiebot', 2);
    await seedVisit('shop', 'cookiebot', 9); // prior window
    await seedVisit('shop', null, 3); // no banner found
    await seedVisit('blog', 'onetrust', 20); // outside both windows

    const { consentStrategies } = await getStats(db);
    expect(consentStrategies).toEqual(
      expect.arrayContaining([
        { group: 'shop', strategy: 'cookiebot', last7d: 2, prior7d: 1 },
        { group: 'shop', strategy: 'none', last7d: 1, prior7d: 0 },
      ]),
    );
    expect(consentStrategies.find((r) => r.group === 'blog')).toBeUndefined();
  });
});
