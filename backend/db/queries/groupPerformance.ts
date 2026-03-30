import { sql } from 'drizzle-orm';
import type { Db } from '../client';

export interface UrlPerformance {
  url: string;
  p50LoadTimeMs: number;
  p95LoadTimeMs: number;
  p50TtfbMs: number | null;
  p95TtfbMs: number | null;
  isSlow: boolean;
  sampleCount: number;
}

export interface LoadTimeTrendPoint {
  runId: number;
  startedAt: string;
  url: string;
  avgLoadTimeMs: number;
}

export interface GroupPerformance {
  urls: UrlPerformance[];
  loadTimeTrend: LoadTimeTrendPoint[];
}

export async function getGroupPerformance(
  db: Db,
  groupName: string,
  thresholdMs = 3000,
): Promise<GroupPerformance> {
  // P50/P95 per URL using PostgreSQL percentile functions
  const perfRows = await db.execute(sql`
    SELECT
      v.url,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.load_time_ms)::int AS p50_load,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY v.load_time_ms)::int AS p95_load,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.ttfb_ms) FILTER (WHERE v.ttfb_ms IS NOT NULL)::int AS p50_ttfb,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY v.ttfb_ms) FILTER (WHERE v.ttfb_ms IS NOT NULL)::int AS p95_ttfb,
      COUNT(*)::int AS sample_count
    FROM visits v
    INNER JOIN runs r ON v.run_id = r.id
    WHERE r.group_name = ${groupName}
    GROUP BY v.url
    ORDER BY p95_load DESC
  `);

  const urls: UrlPerformance[] = (perfRows as any[]).map((row) => ({
    url: row.url as string,
    p50LoadTimeMs: Number(row.p50_load),
    p95LoadTimeMs: Number(row.p95_load),
    p50TtfbMs: row.p50_ttfb != null ? Number(row.p50_ttfb) : null,
    p95TtfbMs: row.p95_ttfb != null ? Number(row.p95_ttfb) : null,
    isSlow: Number(row.p95_load) > thresholdMs,
    sampleCount: Number(row.sample_count),
  }));

  // Load time trend per URL over last 20 runs
  const trendRows = await db.execute(sql`
    SELECT
      r.id AS run_id,
      r.started_at,
      v.url,
      AVG(v.load_time_ms)::int AS avg_load_time_ms
    FROM visits v
    INNER JOIN runs r ON v.run_id = r.id
    WHERE r.group_name = ${groupName}
      AND r.id IN (
        SELECT id FROM runs WHERE group_name = ${groupName}
        ORDER BY started_at DESC LIMIT 20
      )
    GROUP BY r.id, r.started_at, v.url
    ORDER BY r.started_at ASC, v.url
  `);

  const loadTimeTrend: LoadTimeTrendPoint[] = (trendRows as any[]).map((row) => ({
    runId: Number(row.run_id),
    startedAt: new Date(row.started_at as string).toISOString(),
    url: row.url as string,
    avgLoadTimeMs: Number(row.avg_load_time_ms),
  }));

  return { urls, loadTimeTrend };
}
