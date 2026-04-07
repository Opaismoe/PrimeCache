import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import type { AccessibilityViolation } from '../warmer/visitor';

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

export const visit_accessibility = pgTable('visit_accessibility', {
  id: serial('id').primaryKey(),
  visit_id: integer('visit_id')
    .notNull()
    .references(() => visits.id, { onDelete: 'cascade' }),
  violation_count: integer('violation_count').notNull(),
  critical_count: integer('critical_count').notNull(),
  serious_count: integer('serious_count').notNull(),
  violations: jsonb('violations').notNull().$type<AccessibilityViolation[]>(),
  collected_at: timestamp('collected_at').notNull(),
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
  h2: text('h2'),
  h3: text('h3'),
  h4: text('h4'),
  h5: text('h5'),
  viewport_meta: varchar('viewport_meta', { length: 500 }),
  lang: varchar('lang', { length: 20 }),
  collected_at: timestamp('collected_at').notNull(),
});

export const secrets = pgTable('secrets', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  encrypted_value: text('encrypted_value').notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const group_crawled_urls = pgTable('group_crawled_urls', {
  id: serial('id').primaryKey(),
  group_name: varchar('group_name', { length: 255 }).notNull(),
  url: varchar('url', { length: 2048 }).notNull(),
  first_discovered_at: timestamp('first_discovered_at').notNull(),
});

export const lighthouse_reports = pgTable('lighthouse_reports', {
  id: serial('id').primaryKey(),
  group_name: varchar('group_name', { length: 255 }).notNull(),
  url: varchar('url', { length: 2048 }).notNull(),
  triggered_by: varchar('triggered_by', { length: 50 }).notNull(),
  performance_score: integer('performance_score'),
  accessibility_score: integer('accessibility_score'),
  seo_score: integer('seo_score'),
  best_practices_score: integer('best_practices_score'),
  lcp_ms: integer('lcp_ms'),
  fcp_ms: integer('fcp_ms'),
  cls_score: real('cls_score'),
  tbt_ms: integer('tbt_ms'),
  speed_index_ms: integer('speed_index_ms'),
  inp_ms: integer('inp_ms'),
  ttfb_ms: integer('ttfb_ms'),
  failed: boolean('failed').notNull().default(false),
  error: text('error'),
  audited_at: timestamp('audited_at').notNull(),
  form_factor: varchar('form_factor', { length: 20 }).notNull().default('desktop'),
});
