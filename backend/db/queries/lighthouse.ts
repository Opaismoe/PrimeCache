import { sql } from 'drizzle-orm';
import type { LighthouseResult } from '../../services/lighthouseAudit';
import type { Db } from '../client';
import { lighthouse_reports } from '../schema';
import { sqlExecuteRows } from '../sqlExecuteRows';

export async function insertLighthouseReport(
  db: Db,
  groupName: string,
  triggeredBy: 'schedule' | 'manual',
  result: LighthouseResult,
): Promise<void> {
  await db.insert(lighthouse_reports).values({
    group_name: groupName,
    url: result.url,
    triggered_by: triggeredBy,
    performance_score: result.performanceScore,
    accessibility_score: result.accessibilityScore,
    seo_score: result.seoScore,
    best_practices_score: result.bestPracticesScore,
    lcp_ms: result.lcpMs,
    fcp_ms: result.fcpMs,
    cls_score: result.clsScore,
    tbt_ms: result.tbtMs,
    speed_index_ms: result.speedIndexMs,
    inp_ms: result.inpMs,
    ttfb_ms: result.ttfbMs,
    failed: result.failed,
    error: result.error ?? null,
    audited_at: new Date(),
  });
}

export interface LighthouseUrlSummary {
  url: string;
  latestReport: {
    performanceScore: number | null;
    accessibilityScore: number | null;
    seoScore: number | null;
    bestPracticesScore: number | null;
    lcpMs: number | null;
    fcpMs: number | null;
    clsScore: number | null;
    tbtMs: number | null;
    speedIndexMs: number | null;
    inpMs: number | null;
    ttfbMs: number | null;
    triggeredBy: 'schedule' | 'manual';
    auditedAt: string;
    failed: boolean;
    error: string | null;
  } | null;
}

export async function getGroupLighthouse(
  db: Db,
  groupName: string,
): Promise<LighthouseUrlSummary[]> {
  // Latest report per URL using DISTINCT ON
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (url)
      url,
      performance_score,
      accessibility_score,
      seo_score,
      best_practices_score,
      lcp_ms,
      fcp_ms,
      cls_score,
      tbt_ms,
      speed_index_ms,
      inp_ms,
      ttfb_ms,
      triggered_by,
      audited_at,
      failed,
      error
    FROM lighthouse_reports
    WHERE group_name = ${groupName}
    ORDER BY url, audited_at DESC
  `);

  return sqlExecuteRows(rows).map((r) => ({
    url: r.url as string,
    latestReport: {
      performanceScore: r.performance_score != null ? Number(r.performance_score) : null,
      accessibilityScore: r.accessibility_score != null ? Number(r.accessibility_score) : null,
      seoScore: r.seo_score != null ? Number(r.seo_score) : null,
      bestPracticesScore: r.best_practices_score != null ? Number(r.best_practices_score) : null,
      lcpMs: r.lcp_ms != null ? Number(r.lcp_ms) : null,
      fcpMs: r.fcp_ms != null ? Number(r.fcp_ms) : null,
      clsScore: r.cls_score != null ? Number(r.cls_score) : null,
      tbtMs: r.tbt_ms != null ? Number(r.tbt_ms) : null,
      speedIndexMs: r.speed_index_ms != null ? Number(r.speed_index_ms) : null,
      inpMs: r.inp_ms != null ? Number(r.inp_ms) : null,
      ttfbMs: r.ttfb_ms != null ? Number(r.ttfb_ms) : null,
      triggeredBy: r.triggered_by as 'schedule' | 'manual',
      auditedAt: new Date(r.audited_at as string).toISOString(),
      failed: Boolean(r.failed),
      error: r.error as string | null,
    },
  }));
}
