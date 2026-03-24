export type RunStatus = 'running' | 'completed' | 'partial_failure' | 'failed' | 'cancelled';

export interface Run {
  id: number;
  group_name: string;
  started_at: string;
  ended_at: string | null;
  status: RunStatus;
  total_urls: number | null;
  success_count: number | null;
  failure_count: number | null;
}

export interface Visit {
  id: number;
  run_id: number;
  url: string;
  status_code: number | null;
  final_url: string | null;
  ttfb_ms: number | null;
  load_time_ms: number;
  consent_found: number;
  consent_strategy: string | null;
  error: string | null;
  visited_at: string;
}

export interface RunDetail extends Run {
  visits: Visit[];
}

export interface GroupOptions {
  scrollToBottom: boolean;
  waitForSelector?: string;
  crawl: boolean;
  crawl_depth?: number;
  userAgent?: string;
}

export interface Group {
  name: string;
  schedule: string;
  urls: string[];
  options: GroupOptions;
}

export interface Config {
  groups: Group[];
}
