import { desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { runs, visit_accessibility, visits } from '../schema';
import type { AccessibilityViolation } from '../../warmer/visitor';

export interface AccessibilityInput {
  violationCount: number;
  criticalCount: number;
  seriousCount: number;
  violations: AccessibilityViolation[];
  collectedAt: Date;
}

export interface AccessibilityRow {
  id: number;
  visitId: number;
  violationCount: number;
  criticalCount: number;
  seriousCount: number;
  violations: AccessibilityViolation[];
  collectedAt: Date;
}

export interface UrlAccessibilitySummary {
  url: string;
  latestViolationCount: number;
  latestCriticalCount: number;
  latestSeriousCount: number;
  topViolations: Array<{
    id: string;
    impact: AccessibilityViolation['impact'];
    help: string;
    helpUrl: string;
    occurrences: number;
  }>;
}

export interface GroupAccessibilityResult {
  urls: UrlAccessibilitySummary[];
}

export async function insertVisitAccessibility(
  db: Db,
  visitId: number,
  data: AccessibilityInput,
): Promise<void> {
  await db.insert(visit_accessibility).values({
    visit_id: visitId,
    violation_count: data.violationCount,
    critical_count: data.criticalCount,
    serious_count: data.seriousCount,
    violations: data.violations,
    collected_at: data.collectedAt,
  });
}

export async function getAccessibilityByVisitId(
  db: Db,
  visitId: number,
): Promise<AccessibilityRow | null> {
  const [row] = await db
    .select()
    .from(visit_accessibility)
    .where(eq(visit_accessibility.visit_id, visitId))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    visitId: row.visit_id,
    violationCount: row.violation_count,
    criticalCount: row.critical_count,
    seriousCount: row.serious_count,
    violations: row.violations as AccessibilityViolation[],
    collectedAt: row.collected_at,
  };
}

export async function getGroupAccessibility(
  db: Db,
  groupName: string,
): Promise<GroupAccessibilityResult> {
  // Latest accessibility row per URL
  const rows = await db
    .select({
      url: visits.url,
      violationCount: visit_accessibility.violation_count,
      criticalCount: visit_accessibility.critical_count,
      seriousCount: visit_accessibility.serious_count,
      violations: visit_accessibility.violations,
      visitedAt: visits.visited_at,
    })
    .from(visit_accessibility)
    .innerJoin(visits, eq(visit_accessibility.visit_id, visits.id))
    .innerJoin(runs, eq(visits.run_id, runs.id))
    .where(sql`${runs.group_name} = ${groupName} AND ${runs.status} != 'cancelled'`)
    .orderBy(desc(visits.visited_at));

  // Group by URL, take latest row per URL, collect all violations for top-5
  const byUrl = new Map<
    string,
    {
      latest: typeof rows[number];
      allViolations: AccessibilityViolation[];
    }
  >();

  for (const row of rows) {
    const entry = byUrl.get(row.url);
    if (!entry) {
      byUrl.set(row.url, {
        latest: row,
        allViolations: row.violations as AccessibilityViolation[],
      });
    } else {
      for (const v of row.violations as AccessibilityViolation[]) {
        entry.allViolations.push(v);
      }
    }
  }

  const urls: UrlAccessibilitySummary[] = [];
  for (const [url, { latest, allViolations }] of byUrl) {
    // Count occurrences per violation id
    const counts = new Map<string, { v: AccessibilityViolation; count: number }>();
    for (const v of allViolations) {
      const existing = counts.get(v.id);
      if (existing) existing.count++;
      else counts.set(v.id, { v, count: 1 });
    }
    const topViolations = [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(({ v, count }) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        helpUrl: v.helpUrl,
        occurrences: count,
      }));

    urls.push({
      url,
      latestViolationCount: latest.violationCount,
      latestCriticalCount: latest.criticalCount,
      latestSeriousCount: latest.seriousCount,
      topViolations,
    });
  }

  return { urls };
}
