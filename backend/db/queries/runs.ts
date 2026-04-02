import { desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { runs } from '../schema';

export type RunRow = typeof runs.$inferSelect;

export async function insertRun(
  db: Db,
  params: { groupName: string; totalUrls: number },
): Promise<number> {
  const [row] = await db
    .insert(runs)
    .values({
      group_name: params.groupName,
      total_urls: params.totalUrls,
      status: 'running',
      started_at: new Date(),
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
): Promise<RunRow[]> {
  const q = db.select().from(runs).orderBy(desc(runs.id)).limit(params.limit).offset(params.offset);
  if (params.group) return q.where(eq(runs.group_name, params.group));
  return q;
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
