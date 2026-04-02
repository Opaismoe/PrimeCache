CREATE TABLE lighthouse_reports (
  id SERIAL PRIMARY KEY,
  group_name VARCHAR(255) NOT NULL,
  url VARCHAR(2048) NOT NULL,
  triggered_by VARCHAR(50) NOT NULL,
  performance_score INTEGER,
  accessibility_score INTEGER,
  seo_score INTEGER,
  best_practices_score INTEGER,
  lcp_ms INTEGER,
  fcp_ms INTEGER,
  cls_score REAL,
  tbt_ms INTEGER,
  speed_index_ms INTEGER,
  inp_ms INTEGER,
  ttfb_ms INTEGER,
  failed BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  audited_at TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_lighthouse_group_url ON lighthouse_reports(group_name, url, audited_at DESC);
