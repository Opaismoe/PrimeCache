import { pgTable, serial, varchar, integer, boolean, text, timestamp } from 'drizzle-orm/pg-core'

export const runs = pgTable('runs', {
  id:            serial('id').primaryKey(),
  group_name:    varchar('group_name', { length: 255 }).notNull(),
  started_at:    timestamp('started_at').notNull(),
  ended_at:      timestamp('ended_at'),
  status:        varchar('status', { length: 255 }).notNull(),
  total_urls:    integer('total_urls'),
  success_count: integer('success_count'),
  failure_count: integer('failure_count'),
})

export const visits = pgTable('visits', {
  id:               serial('id').primaryKey(),
  run_id:           integer('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  url:              varchar('url', { length: 2048 }).notNull(),
  status_code:      integer('status_code'),
  final_url:        varchar('final_url', { length: 2048 }),
  ttfb_ms:          integer('ttfb_ms'),
  load_time_ms:     integer('load_time_ms').notNull(),
  consent_found:    boolean('consent_found').notNull().default(false),
  consent_strategy: varchar('consent_strategy', { length: 255 }),
  error:            text('error'),
  visited_at:       timestamp('visited_at').notNull(),
})
