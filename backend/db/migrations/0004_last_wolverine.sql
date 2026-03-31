CREATE TABLE "visit_accessibility" (
	"id" serial PRIMARY KEY NOT NULL,
	"visit_id" integer NOT NULL,
	"violation_count" integer NOT NULL,
	"critical_count" integer NOT NULL,
	"serious_count" integer NOT NULL,
	"violations" jsonb NOT NULL,
	"collected_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visit_accessibility" ADD CONSTRAINT "visit_accessibility_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE cascade ON UPDATE no action;