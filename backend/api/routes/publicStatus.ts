import { sql } from 'drizzle-orm'
import type { Db } from '../../db/client'

export interface GroupStatus {
  groupName: string
  uptimePct: number
  lastRunAt: string | null
  lastRunStatus: string | null
  urlCount: number
}

export async function getGroupUptime(db: Db): Promise<GroupStatus[]> {
  const rows = await db.execute(sql`
    SELECT
      r.group_name,
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE v.error IS NULL) / NULLIF(COUNT(*), 0),
        1
      )::float                         AS uptime_pct,
      MAX(r.started_at)::text           AS last_run_at,
      (
        SELECT status FROM runs r2
        WHERE r2.group_name = r.group_name
        ORDER BY r2.started_at DESC LIMIT 1
      )                                 AS last_run_status,
      COUNT(DISTINCT v.url)::int        AS url_count
    FROM runs r
    JOIN visits v ON v.run_id = r.id
    WHERE r.started_at >= NOW() - INTERVAL '30 days'
    GROUP BY r.group_name
    ORDER BY r.group_name
  `)
  return (rows as any[]).map((r) => ({
    groupName:     r.group_name as string,
    uptimePct:     Number(r.uptime_pct ?? 0),
    lastRunAt:     r.last_run_at as string | null,
    lastRunStatus: r.last_run_status as string | null,
    urlCount:      r.url_count as number,
  }))
}
