import { sql } from 'drizzle-orm';
import type { Db } from '../client';

/** Normalise db.execute() result — postgres driver returns T[], PGlite returns { rows: T[] } */
function toRows(result: unknown): any[] {
  if (Array.isArray(result)) return result as any[];
  if (result && typeof result === 'object' && 'rows' in result)
    return (result as any).rows as any[];
  return [];
}

type CwvStatus = 'good' | 'needs-improvement' | 'poor';

function lcpStatus(ms: number | null): CwvStatus | null {
  if (ms === null) return null;
  if (ms < 2500) return 'good';
  if (ms < 4000) return 'needs-improvement';
  return 'poor';
}

function fcpStatus(ms: number | null): CwvStatus | null {
  if (ms === null) return null;
  if (ms < 1800) return 'good';
  if (ms < 3000) return 'needs-improvement';
  return 'poor';
}

function clsStatus(score: number | null): CwvStatus | null {
  if (score === null) return null;
  if (score < 0.1) return 'good';
  if (score < 0.25) return 'needs-improvement';
  return 'poor';
}

function inpStatus(ms: number | null): CwvStatus | null {
  if (ms === null) return null;
  if (ms < 200) return 'good';
  if (ms < 500) return 'needs-improvement';
  return 'poor';
}

export interface UrlCwv {
  url: string;
  sampleCount: number;
  lcpP75: number | null;
  fcpP75: number | null;
  clsP75: number | null;
  inpP75: number | null;
  lcpStatus: CwvStatus | null;
  fcpStatus: CwvStatus | null;
  clsStatus: CwvStatus | null;
  inpStatus: CwvStatus | null;
}

export interface CwvTrendPoint {
  runId: number;
  startedAt: string;
  avgLcpMs: number | null;
  avgFcpMs: number | null;
  avgClsScore: number | null;
  avgInpMs: number | null;
}

export interface GroupCwv {
  urls: UrlCwv[];
  trend: CwvTrendPoint[];
}

export async function getGroupCwv(db: Db, groupName: string): Promise<GroupCwv> {
  // Per-URL P75 CWV metrics (Lighthouse uses P75)
  const urlRows = await db.execute(sql`
    SELECT
      v.url,
      COUNT(c.id)::int AS sample_count,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY c.lcp_ms) AS lcp_p75,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY c.fcp_ms) AS fcp_p75,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY c.cls_score) AS cls_p75,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY c.inp_ms) AS inp_p75
    FROM visits v
    INNER JOIN runs r ON r.id = v.run_id
    INNER JOIN visit_cwv c ON c.visit_id = v.id
    WHERE r.group_name = ${groupName}
    GROUP BY v.url
    ORDER BY lcp_p75 DESC NULLS LAST
  `);

  const urls: UrlCwv[] = toRows(urlRows).map((row) => {
    const lcp = row.lcp_p75 != null ? Math.round(Number(row.lcp_p75)) : null;
    const fcp = row.fcp_p75 != null ? Math.round(Number(row.fcp_p75)) : null;
    const cls = row.cls_p75 != null ? Math.round(Number(row.cls_p75) * 1000) / 1000 : null;
    const inp = row.inp_p75 != null ? Math.round(Number(row.inp_p75)) : null;
    return {
      url: row.url as string,
      sampleCount: Number(row.sample_count),
      lcpP75: lcp,
      fcpP75: fcp,
      clsP75: cls,
      inpP75: inp,
      lcpStatus: lcpStatus(lcp),
      fcpStatus: fcpStatus(fcp),
      clsStatus: clsStatus(cls),
      inpStatus: inpStatus(inp),
    };
  });

  // Per-run avg CWV trend (oldest first for charting)
  const trendRows = await db.execute(sql`
    SELECT
      r.id AS run_id,
      r.started_at,
      AVG(c.lcp_ms)::int    AS avg_lcp_ms,
      AVG(c.fcp_ms)::int    AS avg_fcp_ms,
      AVG(c.cls_score)      AS avg_cls_score,
      AVG(c.inp_ms)::int    AS avg_inp_ms
    FROM runs r
    INNER JOIN visits v ON v.run_id = r.id
    INNER JOIN visit_cwv c ON c.visit_id = v.id
    WHERE r.group_name = ${groupName}
    GROUP BY r.id, r.started_at
    ORDER BY r.started_at ASC
    LIMIT 30
  `);

  const trend: CwvTrendPoint[] = toRows(trendRows).map((row) => ({
    runId: Number(row.run_id),
    startedAt: new Date(row.started_at as string).toISOString(),
    avgLcpMs: row.avg_lcp_ms != null ? Number(row.avg_lcp_ms) : null,
    avgFcpMs: row.avg_fcp_ms != null ? Number(row.avg_fcp_ms) : null,
    avgClsScore:
      row.avg_cls_score != null ? Math.round(Number(row.avg_cls_score) * 1000) / 1000 : null,
    avgInpMs: row.avg_inp_ms != null ? Number(row.avg_inp_ms) : null,
  }));

  return { urls, trend };
}
