import { eq } from 'drizzle-orm';
import type { Db } from '../client';
import { secrets } from '../schema';

export type SecretRow = typeof secrets.$inferSelect;
export type SecretListRow = Pick<SecretRow, 'id' | 'name' | 'created_at' | 'updated_at'>;

export async function upsertSecret(
  db: Db,
  name: string,
  encryptedValue: string,
): Promise<SecretRow> {
  const [row] = await db
    .insert(secrets)
    .values({ name, encrypted_value: encryptedValue })
    .onConflictDoUpdate({
      target: secrets.name,
      set: { encrypted_value: encryptedValue, updated_at: new Date() },
    })
    .returning();
  return row;
}

export async function getSecret(db: Db, name: string): Promise<SecretRow | null> {
  const [row] = await db.select().from(secrets).where(eq(secrets.name, name)).limit(1);
  return row ?? null;
}

export async function listSecrets(db: Db): Promise<SecretListRow[]> {
  return db
    .select({
      id: secrets.id,
      name: secrets.name,
      created_at: secrets.created_at,
      updated_at: secrets.updated_at,
    })
    .from(secrets);
}

export async function deleteSecret(db: Db, name: string): Promise<number> {
  const rows = await db.delete(secrets).where(eq(secrets.name, name)).returning({ id: secrets.id });
  return rows.length;
}
