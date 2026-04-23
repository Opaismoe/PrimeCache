import { and, eq, gt, lt } from 'drizzle-orm';
import type { Db } from '../client';
import { sessions } from '../schema';

export type SessionRow = typeof sessions.$inferSelect;

export async function createSession(
  db: Db,
  params: { id: string; csrfToken: string; expiresAt: Date },
): Promise<void> {
  await db.insert(sessions).values({
    id: params.id,
    csrf_token: params.csrfToken,
    expires_at: params.expiresAt,
  });
}

export async function findActiveSession(db: Db, id: string): Promise<SessionRow | null> {
  const [row] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, id), gt(sessions.expires_at, new Date())))
    .limit(1);
  return row ?? null;
}

export async function deleteSession(db: Db, id: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, id));
}

export async function touchSession(db: Db, id: string): Promise<void> {
  await db.update(sessions).set({ last_used_at: new Date() }).where(eq(sessions.id, id));
}

export async function deleteExpiredSessions(db: Db): Promise<number> {
  const deleted = await db
    .delete(sessions)
    .where(lt(sessions.expires_at, new Date()))
    .returning({ id: sessions.id });
  return deleted.length;
}
