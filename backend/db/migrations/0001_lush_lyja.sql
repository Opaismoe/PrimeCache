CREATE TABLE "visit_seo" (
	"id" serial PRIMARY KEY NOT NULL,
	"visit_id" integer NOT NULL,
	"title" text,
	"meta_description" text,
	"h1" text,
	"canonical_url" varchar(2048),
	"og_title" text,
	"og_description" text,
	"og_image" varchar(2048),
	"robots_meta" varchar(255),
	"collected_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visit_seo" ADD CONSTRAINT "visit_seo_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE cascade ON UPDATE no action;