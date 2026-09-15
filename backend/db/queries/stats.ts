import { ne, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { runs, visits } from '../schema';

export interface ConsentStrategyStat {
  group: string;
  /** Strategy name, or 'none' when no banner was dismissed. */
  strategy: string;
  last7d: number;
  prior7d: number;
}

export interface Stats {
  statusCounts: Record<string, number>;
  visitsByDay: Array<{ date: string; group: string; count: number }>;
  /** Week-over-week consent dismissals per strategy — a CMP DOM change shows up as a drop. */
  consentStrategies: ConsentStrategyStat[];
}

export async function getStats(db: Db): Promise<Stats> {
  const statusRows = await db
    .select({
      status: runs.status,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(runs)
    .where(ne(runs.status, 'running'))
    .groupBy(runs.status);

  const statusCounts: Record<string, number> = {};
  for (const row of statusRows) {
    statusCounts[row.status] = Number(row.count);
  }

  const visitsByDay = await db
    .select({
      date: sql<string>`(${visits.visited_at})::date::text`.as('date'),
      group: runs.group_name,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(visits)
    .innerJoin(runs, sql`${visits.run_id} = ${runs.id}`)
    .where(sql`${visits.visited_at} >= now() - interval '30 days'`)
    .groupBy(sql`(${visits.visited_at})::date`, runs.group_name)
    .orderBy(sql`(${visits.visited_at})::date`)
    .then((rows) => rows.map((r) => ({ date: r.date, group: r.group, count: Number(r.count) })));

  const consentStrategies = await db
    .select({
      group: runs.group_name,
      strategy: sql<string>`coalesce(${visits.consent_strategy}, 'none')`.as('strategy'),
      last7d: sql<number>`count(*) filter (where ${visits.visited_at} >= now() - interval '7 days')`,
      prior7d: sql<number>`count(*) filter (where ${visits.visited_at} < now() - interval '7 days')`,
    })
    .from(visits)
    .innerJoin(runs, sql`${visits.run_id} = ${runs.id}`)
    .where(sql`${visits.visited_at} >= now() - interval '14 days'`)
    .groupBy(runs.group_name, sql`coalesce(${visits.consent_strategy}, 'none')`)
    .orderBy(runs.group_name, sql`coalesce(${visits.consent_strategy}, 'none')`)
    .then((rows) =>
      rows.map((r) => ({
        group: r.group,
        strategy: r.strategy,
        last7d: Number(r.last7d),
        prior7d: Number(r.prior7d),
      })),
    );

  return { statusCounts, visitsByDay, consentStrategies };
}
