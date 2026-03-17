import knex from 'knex'
import { env } from '../config/env'

export const db = knex({
  client: 'better-sqlite3',
  connection: { filename: env.DB_PATH },
  useNullAsDefault: true,
})