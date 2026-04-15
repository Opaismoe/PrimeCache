CREATE TABLE "webhook_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_name" varchar(255) NOT NULL,
  "token" varchar(64) NOT NULL,
  "description" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "last_used_at" timestamp,
  CONSTRAINT "webhook_tokens_token_unique" UNIQUE("token")
);
