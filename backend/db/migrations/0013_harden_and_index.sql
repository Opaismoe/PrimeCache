-- Webhook tokens: store sha256(hex) instead of plaintext. Existing rows are
-- hashed in place; callers keep using the plaintext they were issued.
UPDATE "webhook_tokens" SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex');
--> statement-breakpoint
-- Indexes the per-group aggregate queries (performance/uptime/seo/cwv) and
-- cascade deletes rely on. Previously only primary keys existed.
CREATE INDEX IF NOT EXISTS "visits_run_id_idx" ON "visits" ("run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visits_url_idx" ON "visits" ("url");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "runs_group_started_idx" ON "runs" ("group_name", "started_at" DESC);
--> statement-breakpoint
-- Run provenance: what started the run, and which webhook token if any.
ALTER TABLE "runs" ADD COLUMN IF NOT EXISTS "triggered_by" varchar(50) NOT NULL DEFAULT 'unknown';
--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN IF NOT EXISTS "webhook_token_id" integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "runs_webhook_token_id_idx" ON "runs" ("webhook_token_id");
