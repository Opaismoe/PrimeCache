import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from '../client';
import { webhook_tokens } from '../schema';

export type WebhookTokenRow = typeof webhook_tokens.$inferSelect;

export type WebhookTokenPublic = Omit<WebhookTokenRow, 'token'>;

export async function listWebhookTokens(db: Db, groupName: string): Promise<WebhookTokenPublic[]> {
  return db
    .select({
      id: webhook_tokens.id,
      group_name: webhook_tokens.group_name,
      description: webhook_tokens.description,
      active: webhook_tokens.active,
      created_at: webhook_tokens.created_at,
      last_used_at: webhook_tokens.last_used_at,
    })
    .from(webhook_tokens)
    .where(eq(webhook_tokens.group_name, groupName));
}

export async function createWebhookToken(
  db: Db,
  params: { groupName: string; description?: string },
): Promise<WebhookTokenRow> {
  const token = randomBytes(32).toString('hex');
  const [row] = await db
    .insert(webhook_tokens)
    .values({
      group_name: params.groupName,
      token,
      description: params.description ?? null,
    })
    .returning();
  return row;
}

export async function deleteWebhookToken(db: Db, id: number): Promise<boolean> {
  const deleted = await db
    .delete(webhook_tokens)
    .where(eq(webhook_tokens.id, id))
    .returning({ id: webhook_tokens.id });
  return deleted.length > 0;
}

export async function setWebhookTokenActive(
  db: Db,
  id: number,
  active: boolean,
): Promise<boolean> {
  const updated = await db
    .update(webhook_tokens)
    .set({ active })
    .where(eq(webhook_tokens.id, id))
    .returning({ id: webhook_tokens.id });
  return updated.length > 0;
}

export async function findWebhookToken(
  db: Db,
  token: string,
): Promise<WebhookTokenRow | null> {
  const [row] = await db
    .select()
    .from(webhook_tokens)
    .where(eq(webhook_tokens.token, token))
    .limit(1);
  return row ?? null;
}

export async function touchWebhookToken(db: Db, id: number): Promise<void> {
  await db
    .update(webhook_tokens)
    .set({ last_used_at: new Date() })
    .where(eq(webhook_tokens.id, id));
}

export async function renameGroupWebhookTokens(
  db: Db,
  oldName: string,
  newName: string,
): Promise<void> {
  await db
    .update(webhook_tokens)
    .set({ group_name: newName })
    .where(eq(webhook_tokens.group_name, oldName));
}
