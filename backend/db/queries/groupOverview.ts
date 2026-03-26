import { eq, desc, sql } from 'drizzle-orm'
import { runs, visits } from '../schema'
import type { Db } from '../client'

export interface GroupOverviewStats {
  totalRuns: number
  successRate: number   // 0-100
  avgLoadTimeMs: number
  avgTtfbMs: number | null
}

export interface GroupRunSeries {
  runId: number
  startedAt: string
  successRate: number   // 0-100
  avgLoadTimeMs: number
}

export interface GroupOverview {
  recentRuns: {
    id: number
    group_name: string
    started_at: string
    ended_at: string | null
    status: string
    total_urls: number | null
    success_count: number | null
    failure_count: number | null
  }[]
  stats: GroupOverviewStats
  series: GroupRunSeries[]
}

export async function getGroupOverview(db: Db, groupName: string): Promise<GroupOverview> {
  const recentRuns = await db
    .select()
    .from(runs)
    .where(eq(runs.group_name, groupName))
    .orderBy(desc(runs.started_at))
    .limit(10)

  // Overall stats: aggregate over visits joined to this group's runs
  const [visitStats] = await db
    .select({
      avgLoadTimeMs: sql<number>`AVG(${visits.load_time_ms})::int`,
      avgTtfbMs:    sql<number | null>`AVG(${visits.ttfb_ms})::int`,
    })
    .from(visits)
    .innerJoin(runs, eq(visits.run_id, runs.id))
    .where(eq(runs.group_name, groupName))

  // Run-level stats
  const [runStats] = await db
    .select({
      totalRuns:       sql<number>`COUNT(*)::int`,
      totalSuccess:    sql<number>`SUM(COALESCE(${runs.success_count}, 0))::int`,
      totalUrls:       sql<number>`SUM(COALESCE(${runs.total_urls}, 0))::int`,
    })
    .from(runs)
    .where(eq(runs.group_name, groupName))

  const successRate = runStats && runStats.totalUrls > 0
    ? (runStats.totalSuccess / runStats.totalUrls) * 100
    : 0

  // Per-run series for charts (last 30 runs, returned ascending for chart order)
  const seriesRows = await db
    .select({
      runId:        runs.id,
      startedAt:    runs.started_at,
      successCount: runs.success_count,
      totalUrls:    runs.total_urls,
      avgLoadTimeMs: sql<number>`AVG(${visits.load_time_ms})::int`,
    })
    .from(runs)
    .leftJoin(visits, eq(visits.run_id, runs.id))
    .where(eq(runs.group_name, groupName))
    .groupBy(runs.id)
    .orderBy(desc(runs.started_at))
    .limit(30)

  const series: GroupRunSeries[] = seriesRows
    .reverse()
    .map((r) => ({
      runId: r.runId,
      startedAt: r.startedAt.toISOString(),
      successRate: r.totalUrls && r.totalUrls > 0
        ? ((r.successCount ?? 0) / r.totalUrls) * 100
        : 0,
      avgLoadTimeMs: r.avgLoadTimeMs ?? 0,
    }))

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
  }
}
