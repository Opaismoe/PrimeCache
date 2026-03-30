import { asc, eq } from 'drizzle-orm';
import type { Db } from '../client';
import { visits } from '../schema';

export type VisitRow = typeof visits.$inferSelect;

export interface VisitInput {
  url: string;
  statusCode: number | null;
  finalUrl: string | null;
  ttfbMs: number | null;
  loadTimeMs: number;
  redirectCount: number;
  consentFound: boolean;
  consentStrategy: string | null;
  error: string | null;
}

export async function insertVisit(db: Db, runId: number, visit: VisitInput): Promise<number> {
  const [row] = await db
    .insert(visits)
    .values({
      run_id: runId,
      url: visit.url,
      status_code: visit.statusCode,
      final_url: visit.finalUrl,
      ttfb_ms: visit.ttfbMs,
      load_time_ms: visit.loadTimeMs,
      redirect_count: visit.redirectCount,
      consent_found: visit.consentFound,
      consent_strategy: visit.consentStrategy,
      error: visit.error,
      visited_at: new Date(),
    })
    .returning({ id: visits.id });
  return row.id;
}

export async function insertVisits(db: Db, runId: number, inputs: VisitInput[]): Promise<number> {
  await db.insert(visits).values(
    inputs.map((v) => ({
      run_id: runId,
      url: v.url,
      status_code: v.statusCode,
      final_url: v.finalUrl,
      ttfb_ms: v.ttfbMs,
      load_time_ms: v.loadTimeMs,
      consent_found: v.consentFound,
      consent_strategy: v.consentStrategy,
      error: v.error,
      visited_at: new Date(),
    })),
  );
  return inputs.length;
}

export async function getVisitsByRunId(db: Db, runId: number): Promise<VisitRow[]> {
  return db.select().from(visits).where(eq(visits.run_id, runId)).orderBy(asc(visits.visited_at));
}
