CREATE TABLE "runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_name" varchar(255) NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"status" varchar(255) NOT NULL,
	"total_urls" integer,
	"success_count" integer,
	"failure_count" integer
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"url" varchar(2048) NOT NULL,
	"status_code" integer,
	"final_url" varchar(2048),
	"ttfb_ms" integer,
	"load_time_ms" integer NOT NULL,
	"consent_found" boolean DEFAULT false NOT NULL,
	"consent_strategy" varchar(255),
	"error" text,
	"visited_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;