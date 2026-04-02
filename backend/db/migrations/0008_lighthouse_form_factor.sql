ALTER TABLE lighthouse_reports ADD COLUMN form_factor VARCHAR(20) NOT NULL DEFAULT 'desktop';
--> statement-breakpoint
CREATE INDEX idx_lighthouse_group_url_ff ON lighthouse_reports(group_name, url, form_factor, audited_at DESC);
