import knex from 'knex'
import path from 'path'
import { env } from '../config/env'

export const db = knex({
  client: 'better-sqlite3',
  connection: { filename: env.DB_PATH },
  useNullAsDefault: true,
  migrations: {
    // Always use compiled .js migrations so the same DB works in both dev and prod.
    // ts-node:  __dirname = backend/db/      → ../dist/db/migrations = backend/dist/db/migrations
    // compiled: __dirname = backend/dist/db/ → migrations            = backend/dist/db/migrations
    directory: __filename.endsWith('.ts')
      ? path.join(__dirname, '..', 'dist', 'db', 'migrations')
      : path.join(__dirname, 'migrations'),
    loadExtensions: ['.js'],
  },
})
