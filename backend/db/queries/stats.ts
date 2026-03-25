import type { Knex } from 'knex'

export interface Stats {
  statusCounts: Record<string, number>
  visitsByDay: Array<{ date: string; group: string; count: number }>
}

export async function getStats(db: Knex): Promise<Stats> {
  const statusRows: Array<{ status: string; count: number }> = await db('runs')
    .select('status')
    .count('* as count')
    .whereNot({ status: 'running' })
    .groupBy('status')

  const statusCounts: Record<string, number> = {}
  for (const row of statusRows) {
    statusCounts[row.status] = Number(row.count)
  }

  const visitsByDay: Array<{ date: string; group: string; count: number }> = await db('visits as v')
    .join('runs as r', 'v.run_id', 'r.id')
    .select(db.raw("date(v.visited_at) as date"), 'r.group_name as group')
    .count('* as count')
    .where('v.visited_at', '>=', db.raw("date('now', '-30 days')"))
    .groupBy('date', 'r.group_name')
    .orderBy('date', 'asc')
    .then((rows: any[]) => rows.map((r) => ({ date: r.date, group: r.group, count: Number(r.count) })))

  return { statusCounts, visitsByDay }
}
