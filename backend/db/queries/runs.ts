import { desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { type RunTrigger, runs, visits } from '../schema';

export type RunRow = typeof runs.$inferSelect;

export interface RunVisitAverages {
  avg_load_time_ms: number | null;
  avg_ttfb_ms: number | null;
}

/** Per-run mean load/TTFB over all visits — the same averages the run detail page shows. */
export async function getRunVisitAverages(
  db: Db,
  runIds: number[],
): Promise<Map<number, RunVisitAverages>> {
  if (runIds.length === 0) return new Map();
  const rows = await db
    .select({
      runId: visits.run_id,
      avgLoad: sql<number>`ROUND(AVG(${visits.load_time_ms}))::int`,
      avgTtfb: sql<number | null>`ROUND(AVG(${visits.ttfb_ms}))::int`,
    })
    .from(visits)
    .where(inArray(visits.run_id, runIds))
    .groupBy(visits.run_id);
  return new Map(
    rows.map((r) => [r.runId, { avg_load_time_ms: r.avgLoad, avg_ttfb_ms: r.avgTtfb }]),
  );
}

export function withVisitAverages<T extends { id: number }>(
  rows: T[],
  averages: Map<number, RunVisitAverages>,
): (T & RunVisitAverages)[] {
  return rows.map((r) => ({
    ...r,
    avg_load_time_ms: averages.get(r.id)?.avg_load_time_ms ?? null,
    avg_ttfb_ms: averages.get(r.id)?.avg_ttfb_ms ?? null,
  }));
}

export async function insertRun(
  db: Db,
  params: {
    groupName: string;
    totalUrls: number;
    triggeredBy?: RunTrigger;
    webhookTokenId?: number | null;
  },
): Promise<number> {
  const [row] = await db
    .insert(runs)
    .values({
      group_name: params.groupName,
      total_urls: params.totalUrls,
      status: 'running',
      started_at: new Date(),
      triggered_by: params.triggeredBy ?? 'unknown',
      webhook_token_id: params.webhookTokenId ?? null,
    })
    .returning({ id: runs.id });
  return row.id;
}

export async function finalizeRun(
  db: Db,
  id: number,
  params: { status: string; successCount: number; failureCount: number },
): Promise<void> {
  await db
    .update(runs)
    .set({
      status: params.status,
      success_count: params.successCount,
      failure_count: params.failureCount,
      total_urls: params.successCount + params.failureCount,
      ended_at: new Date(),
    })
    .where(eq(runs.id, id));
}

export async function getRuns(
  db: Db,
  params: { limit: number; offset: number; group?: string },
): Promise<(RunRow & RunVisitAverages)[]> {
  const q = db.select().from(runs).orderBy(desc(runs.id)).limit(params.limit).offset(params.offset);
  const rows = params.group ? await q.where(eq(runs.group_name, params.group)) : await q;
  return withVisitAverages(
    rows,
    await getRunVisitAverages(
      db,
      rows.map((r) => r.id),
    ),
  );
}

export async function getRunById(db: Db, id: number): Promise<RunRow | null> {
  const [row] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
  return row ?? null;
}

export async function deleteRuns(db: Db, opts?: { group?: string }): Promise<number> {
  const q = db.delete(runs);
  const deleted = opts?.group
    ? await q.where(eq(runs.group_name, opts.group)).returning({ id: runs.id })
    : await q.returning({ id: runs.id });
  return deleted.length;
}

export async function renameGroup(db: Db, oldName: string, newName: string): Promise<void> {
  await db.update(runs).set({ group_name: newName }).where(eq(runs.group_name, oldName));
}

export async function getLatestPerGroup(db: Db): Promise<RunRow[]> {
  const maxIdPerGroup = db
    .select({ id: sql<number>`max(${runs.id})`.as('id') })
    .from(runs)
    .groupBy(runs.group_name)
    .as('latest');

  return db
    .select()
    .from(runs)
    .where(inArray(runs.id, sql`(select id from ${maxIdPerGroup})`))
    .orderBy(desc(runs.id));
}
