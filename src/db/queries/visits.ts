import type { Knex } from 'knex'

export interface VisitInput {
  url: string
  statusCode: number | null
  finalUrl: string | null
  ttfbMs: number | null
  loadTimeMs: number
  consentFound: boolean
  consentStrategy: string | null
  error: string | null
}

export interface VisitRow {
  id: number
  run_id: number
  url: string
  status_code: number | null
  final_url: string | null
  ttfb_ms: number | null
  load_time_ms: number
  consent_found: number   // SQLite stores booleans as 0/1
  consent_strategy: string | null
  error: string | null
  visited_at: string
}

export async function insertVisits(
  db: Knex,
  runId: number,
  visits: VisitInput[],
): Promise<number> {
  const rows = visits.map((v) => ({
    run_id: runId,
    url: v.url,
    status_code: v.statusCode,
    final_url: v.finalUrl,
    ttfb_ms: v.ttfbMs,
    load_time_ms: v.loadTimeMs,
    consent_found: v.consentFound ? 1 : 0,
    consent_strategy: v.consentStrategy,
    error: v.error,
    visited_at: new Date().toISOString(),
  }))

  await db('visits').insert(rows)
  return rows.length
}

export async function getVisitsByRunId(db: Knex, runId: number): Promise<VisitRow[]> {
  return db('visits').where({ run_id: runId }).orderBy('visited_at', 'asc')
}
