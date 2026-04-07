CREATE TABLE "group_crawled_urls" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_name" varchar(255) NOT NULL,
  "url" varchar(2048) NOT NULL,
  "first_discovered_at" timestamp NOT NULL,
  CONSTRAINT "group_crawled_urls_group_url_unique" UNIQUE("group_name","url")
);
