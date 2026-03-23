import type { Knex } from 'knex'

export interface RunRow {
  id: number
  group_name: string
  started_at: string
  ended_at: string | null
  status: 'running' | 'completed' | 'partial_failure' | 'failed' | 'cancelled'
  total_urls: number | null
  success_count: number | null
  failure_count: number | null
}

export async function insertRun(
  db: Knex,
  params: { groupName: string; totalUrls: number },
): Promise<number> {
  const [id] = await db('runs').insert({
    group_name: params.groupName,
    total_urls: params.totalUrls,
    status: 'running',
    started_at: new Date().toISOString(),
  })
  return id
}

export async function finalizeRun(
  db: Knex,
  id: number,
  params: { status: RunRow['status']; successCount: number; failureCount: number },
): Promise<void> {
  await db('runs').where({ id }).update({
    status: params.status,
    success_count: params.successCount,
    failure_count: params.failureCount,
    ended_at: new Date().toISOString(),
  })
}

export async function getRuns(
  db: Knex,
  params: { limit: number; offset: number },
): Promise<RunRow[]> {
  return db('runs')
    .orderBy('id', 'desc')
    .limit(params.limit)
    .offset(params.offset)
}

export async function getRunById(db: Knex, id: number): Promise<RunRow | null> {
  const row = await db('runs').where({ id }).first()
  return row ?? null
}

export async function getLatestPerGroup(db: Knex): Promise<RunRow[]> {
  // SQLite: get the row with the max id per group_name
  return db('runs')
    .whereIn(
      'id',
      db('runs').groupBy('group_name').max('id as id'),
    )
    .orderBy('id', 'desc')
}
