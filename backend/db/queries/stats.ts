import { ne, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { runs, visits } from '../schema';

export interface Stats {
  statusCounts: Record<string, number>;
  visitsByDay: Array<{ date: string; group: string; count: number }>;
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

  return { statusCounts, visitsByDay };
}
