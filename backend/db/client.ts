import { drizzle } from 'drizzle-orm/postgres-js'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import postgres from 'postgres'
import { env } from '../config/env'
import * as schema from './schema'

const queryClient = postgres(env.DATABASE_URL)
export const db = drizzle({ client: queryClient, schema })

// Abstract over driver-specific types so PGlite and postgres-js are both assignable
export type Db = PgDatabase<any, typeof schema>

export async function destroyDb(): Promise<void> {
  await queryClient.end()
}
