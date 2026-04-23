CREATE TABLE IF NOT EXISTS "webhook_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_name" varchar(255) NOT NULL,
  "token" varchar(64) NOT NULL,
  "description" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "last_used_at" timestamp,
  CONSTRAINT "webhook_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "csrf_token" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "last_used_at" timestamp NOT NULL DEFAULT now(),
  "expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" ("expires_at");
