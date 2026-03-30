import { sql } from 'drizzle-orm';
import type { Db } from '../client';
import { sqlExecuteRows } from '../sqlExecuteRows';

export interface UrlUptime {
  url: string;
  uptimePct: number;
  totalChecks: number;
  downCount: number;
  lastStatus: 'up' | 'down';
  lastCheckedAt: string;
}

export interface UptimeTimelinePoint {
  url: string;
  visitedAt: string;
  isDown: boolean;
}

export interface UptimeTrendPoint {
  runId: number;
  startedAt: string;
  url: string;
  wasDown: boolean;
}

export interface GroupUptime {
  urls: UrlUptime[];
  timeline: UptimeTimelinePoint[];
  uptimeTrend: UptimeTrendPoint[];
}

export async function getGroupUptime(db: Db, groupName: string): Promise<GroupUptime> {
  // Per-URL uptime stats — "down" is defined as error IS NOT NULL
  const uptimeRows = await db.execute(sql`
    SELECT
      v.url,
      COUNT(*)::int AS total_checks,
      COUNT(*) FILTER (WHERE v.error IS NOT NULL)::int AS down_count,
      COUNT(*) FILTER (WHERE v.error IS NULL) * 100.0 / COUNT(*) AS uptime_pct,
      MAX(v.visited_at) AS last_checked_at,
      (
        SELECT v2.error IS NOT NULL
        FROM visits v2
        INNER JOIN runs r2 ON v2.run_id = r2.id
        WHERE r2.group_name = ${groupName} AND v2.url = v.url
        ORDER BY v2.visited_at DESC LIMIT 1
      ) AS last_is_down
    FROM visits v
    INNER JOIN runs r ON v.run_id = r.id
    WHERE r.group_name = ${groupName}
    GROUP BY v.url
    ORDER BY uptime_pct ASC
  `);

  const urls: UrlUptime[] = sqlExecuteRows(uptimeRows).map((row) => ({
    url: row.url as string,
    uptimePct: Math.round(Number(row.uptime_pct) * 10) / 10,
    totalChecks: Number(row.total_checks),
    downCount: Number(row.down_count),
    lastStatus: row.last_is_down ? 'down' : 'up',
    lastCheckedAt: new Date(row.last_checked_at as string).toISOString(),
  }));

  // Timeline: last 200 visit results per group for status chart (most recent visits)
  const timelineRows = await db.execute(sql`
    SELECT
      v.url,
      v.visited_at,
      (v.error IS NOT NULL) AS is_down
    FROM visits v
    INNER JOIN runs r ON v.run_id = r.id
    WHERE r.group_name = ${groupName}
    ORDER BY v.visited_at DESC
    LIMIT 200
  `);

  const timeline: UptimeTimelinePoint[] = sqlExecuteRows(timelineRows).map((row) => ({
    url: row.url as string,
    visitedAt: new Date(row.visited_at as string).toISOString(),
    isDown: Boolean(row.is_down),
  }));

  // Per-run per-URL trend: oldest first for charting
  const trendRows = await db.execute(sql`
    SELECT
      r.id AS run_id,
      r.started_at,
      v.url,
      (v.error IS NOT NULL) AS was_down
    FROM visits v
    INNER JOIN runs r ON v.run_id = r.id
    WHERE r.group_name = ${groupName}
    ORDER BY r.started_at ASC
    LIMIT 600
  `);

  const uptimeTrend: UptimeTrendPoint[] = sqlExecuteRows(trendRows).map((row) => ({
    runId: Number(row.run_id),
    startedAt: new Date(row.started_at as string).toISOString(),
    url: row.url as string,
    wasDown: Boolean(row.was_down),
  }));

  return { urls, timeline, uptimeTrend };
}
