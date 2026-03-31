import { and, desc, eq, ne, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { runs, visits } from '../schema';
import { sqlExecuteRows } from '../sqlExecuteRows';

export interface GroupOverviewStats {
  totalRuns: number;
  successRate: number; // 0-100
  avgLoadTimeMs: number;
  avgTtfbMs: number | null;
}

export interface GroupRunSeries {
  runId: number;
  startedAt: string;
  successRate: number; // 0-100
  avgLoadTimeMs: number;
  uptimePct: number; // 0-100, % of visits with no error
  avgSeoScore: number | null; // 0-100 avg SEO score, null if no SEO data
}

export interface GroupOverview {
  recentRuns: {
    id: number;
    group_name: string;
    started_at: string;
    ended_at: string | null;
    status: string;
    total_urls: number | null;
    success_count: number | null;
    failure_count: number | null;
  }[];
  stats: GroupOverviewStats;
  series: GroupRunSeries[];
}

export async function getGroupOverview(db: Db, groupName: string): Promise<GroupOverview> {
  const recentRuns = await db
    .select()
    .from(runs)
    .where(eq(runs.group_name, groupName))
    .orderBy(desc(runs.started_at))
    .limit(10);

  // Overall stats: aggregate over visits joined to this group's runs
  const [visitStats] = await db
    .select({
      avgLoadTimeMs: sql<number>`AVG(${visits.load_time_ms})::int`,
      avgTtfbMs: sql<number | null>`AVG(${visits.ttfb_ms})::int`,
    })
    .from(visits)
    .innerJoin(runs, eq(visits.run_id, runs.id))
    .where(and(eq(runs.group_name, groupName), ne(runs.status, 'cancelled')));

  // Run-level stats
  const [runStats] = await db
    .select({
      totalRuns: sql<number>`COUNT(*)::int`,
      totalSuccess: sql<number>`SUM(COALESCE(${runs.success_count}, 0))::int`,
      totalUrls: sql<number>`SUM(COALESCE(${runs.total_urls}, 0))::int`,
    })
    .from(runs)
    .where(and(eq(runs.group_name, groupName), ne(runs.status, 'cancelled')));

  const successRate =
    runStats && runStats.totalUrls > 0 ? (runStats.totalSuccess / runStats.totalUrls) * 100 : 0;

  // Per-run series for charts (last 30 runs, returned ascending for chart order)
  const seriesRows = await db
    .select({
      runId: runs.id,
      startedAt: runs.started_at,
      successCount: runs.success_count,
      totalUrls: runs.total_urls,
      avgLoadTimeMs: sql<number>`AVG(${visits.load_time_ms})::int`,
      uptimePct: sql<number>`
        COUNT(*) FILTER (WHERE ${visits.error} IS NULL) * 100.0 / NULLIF(COUNT(*), 0)
      `,
    })
    .from(runs)
    .leftJoin(visits, eq(visits.run_id, runs.id))
    .where(and(eq(runs.group_name, groupName), ne(runs.status, 'cancelled')))
    .groupBy(runs.id)
    .orderBy(desc(runs.started_at))
    .limit(30);

  // Per-run avg SEO score (SQL approximation of the scoreSeo() logic)
  const seoScoreRows = await db.execute(sql`
    SELECT
      r.id AS run_id,
      AVG(
        CASE WHEN s.title IS NOT NULL AND length(s.title) BETWEEN 10 AND 60 THEN 20
             WHEN s.title IS NOT NULL THEN 10 ELSE 0 END +
        CASE WHEN s.meta_description IS NOT NULL AND length(s.meta_description) BETWEEN 50 AND 160 THEN 20
             WHEN s.meta_description IS NOT NULL THEN 10 ELSE 0 END +
        CASE WHEN s.h1 IS NOT NULL THEN 20 ELSE 0 END +
        CASE WHEN s.canonical_url IS NOT NULL THEN 15 ELSE 0 END +
        CASE WHEN s.og_title IS NOT NULL AND s.og_description IS NOT NULL THEN 15
             WHEN s.og_title IS NOT NULL OR s.og_description IS NOT NULL THEN 7 ELSE 0 END +
        CASE WHEN s.robots_meta IS NULL OR s.robots_meta NOT ILIKE '%noindex%' THEN 10 ELSE 0 END
      ) AS avg_seo_score
    FROM runs r
    INNER JOIN visits v ON v.run_id = r.id
    INNER JOIN visit_seo s ON s.visit_id = v.id
    WHERE r.group_name = ${groupName}
      AND r.status != 'cancelled'
    GROUP BY r.id
  `);
  const seoByRunId = new Map<number, number>();
  for (const row of sqlExecuteRows(seoScoreRows)) {
    seoByRunId.set(Number(row.run_id), Math.round(Number(row.avg_seo_score) * 10) / 10);
  }

  const series: GroupRunSeries[] = seriesRows.reverse().map((r) => ({
    runId: r.runId,
    startedAt: r.startedAt.toISOString(),
    successRate: r.totalUrls && r.totalUrls > 0 ? ((r.successCount ?? 0) / r.totalUrls) * 100 : 0,
    avgLoadTimeMs: r.avgLoadTimeMs ?? 0,
    uptimePct: Math.round(Number(r.uptimePct) * 10) / 10,
    avgSeoScore: seoByRunId.get(r.runId) ?? null,
  }));

  return {
    recentRuns: recentRuns.map((r) => ({
      ...r,
      started_at: r.started_at.toISOString(),
      ended_at: r.ended_at?.toISOString() ?? null,
    })),
    stats: {
      totalRuns: runStats?.totalRuns ?? 0,
      successRate,
      avgLoadTimeMs: visitStats?.avgLoadTimeMs ?? 0,
      avgTtfbMs: visitStats?.avgTtfbMs ?? null,
    },
    series,
  };
}
