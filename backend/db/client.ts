import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env';
import * as schema from './schema';

const queryClient = postgres(env.DATABASE_URL);
export const db = drizzle({ client: queryClient, schema });

export type Db = typeof db;

export async function destroyDb(): Promise<void> {
  await queryClient.end();
}
