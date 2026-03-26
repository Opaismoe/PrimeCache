CREATE TABLE "visit_broken_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"visit_id" integer NOT NULL,
	"url" varchar(2048) NOT NULL,
	"status_code" integer,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "visit_cwv" (
	"id" serial PRIMARY KEY NOT NULL,
	"visit_id" integer NOT NULL,
	"lcp_ms" integer,
	"cls_score" real,
	"inp_ms" integer,
	"fcp_ms" integer
);
--> statement-breakpoint
CREATE TABLE "visit_headers" (
	"id" serial PRIMARY KEY NOT NULL,
	"visit_id" integer NOT NULL,
	"cache_control" text,
	"x_cache" varchar(255),
	"cf_cache_status" varchar(64),
	"age" integer,
	"etag" varchar(512),
	"content_type" varchar(255),
	"x_frame_options" varchar(255),
	"x_content_type_options" varchar(255),
	"strict_transport_security" text,
	"content_security_policy" text
);
--> statement-breakpoint
CREATE TABLE "visit_screenshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"visit_id" integer NOT NULL,
	"image_data" text NOT NULL,
	"captured_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visits" ADD COLUMN "redirect_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "visit_broken_links" ADD CONSTRAINT "visit_broken_links_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_cwv" ADD CONSTRAINT "visit_cwv_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_headers" ADD CONSTRAINT "visit_headers_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_screenshots" ADD CONSTRAINT "visit_screenshots_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE cascade ON UPDATE no action;