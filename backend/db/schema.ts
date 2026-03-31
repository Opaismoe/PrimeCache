import {
  boolean,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

export const runs = pgTable('runs', {
  id: serial('id').primaryKey(),
  group_name: varchar('group_name', { length: 255 }).notNull(),
  started_at: timestamp('started_at').notNull(),
  ended_at: timestamp('ended_at'),
  status: varchar('status', { length: 255 }).notNull(),
  total_urls: integer('total_urls'),
  success_count: integer('success_count'),
  failure_count: integer('failure_count'),
});

export const visits = pgTable('visits', {
  id: serial('id').primaryKey(),
  run_id: integer('run_id')
    .notNull()
    .references(() => runs.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 2048 }).notNull(),
  status_code: integer('status_code'),
  final_url: varchar('final_url', { length: 2048 }),
  ttfb_ms: integer('ttfb_ms'),
  load_time_ms: integer('load_time_ms').notNull(),
  consent_found: boolean('consent_found').notNull().default(false),
  consent_strategy: varchar('consent_strategy', { length: 255 }),
  error: text('error'),
  visited_at: timestamp('visited_at').notNull(),
  redirect_count: integer('redirect_count').notNull().default(0),
  retry_count: integer('retry_count').notNull().default(0),
});

export const visit_headers = pgTable('visit_headers', {
  id: serial('id').primaryKey(),
  visit_id: integer('visit_id')
    .notNull()
    .references(() => visits.id, { onDelete: 'cascade' }),
  cache_control: text('cache_control'),
  x_cache: varchar('x_cache', { length: 255 }),
  cf_cache_status: varchar('cf_cache_status', { length: 64 }),
  age: integer('age'),
  etag: varchar('etag', { length: 512 }),
  content_type: varchar('content_type', { length: 255 }),
  x_frame_options: varchar('x_frame_options', { length: 255 }),
  x_content_type_options: varchar('x_content_type_options', { length: 255 }),
  strict_transport_security: text('strict_transport_security'),
  content_security_policy: text('content_security_policy'),
});

export const visit_cwv = pgTable('visit_cwv', {
  id: serial('id').primaryKey(),
  visit_id: integer('visit_id')
    .notNull()
    .references(() => visits.id, { onDelete: 'cascade' }),
  lcp_ms: integer('lcp_ms'),
  cls_score: real('cls_score'),
  inp_ms: integer('inp_ms'),
  fcp_ms: integer('fcp_ms'),
});

export const visit_screenshots = pgTable('visit_screenshots', {
  id: serial('id').primaryKey(),
  visit_id: integer('visit_id')
    .notNull()
    .references(() => visits.id, { onDelete: 'cascade' }),
  image_data: text('image_data').notNull(),
  captured_at: timestamp('captured_at').notNull(),
});

export const visit_broken_links = pgTable('visit_broken_links', {
  id: serial('id').primaryKey(),
  visit_id: integer('visit_id')
    .notNull()
    .references(() => visits.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 2048 }).notNull(),
  status_code: integer('status_code'),
  error: text('error'),
});

export const visit_seo = pgTable('visit_seo', {
  id: serial('id').primaryKey(),
  visit_id: integer('visit_id')
    .notNull()
    .references(() => visits.id, { onDelete: 'cascade' }),
  title: text('title'),
  meta_description: text('meta_description'),
  h1: text('h1'),
  canonical_url: varchar('canonical_url', { length: 2048 }),
  og_title: text('og_title'),
  og_description: text('og_description'),
  og_image: varchar('og_image', { length: 2048 }),
  robots_meta: varchar('robots_meta', { length: 255 }),
  collected_at: timestamp('collected_at').notNull(),
});
