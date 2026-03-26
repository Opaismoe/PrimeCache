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
  redirect_count: number;
  consent_found: number;
  consent_strategy: string | null;
  error: string | null;
  visited_at: string;
}

export interface RunDetail extends Run {
  visits: Visit[];
}

export interface Cookie {
  name: string;
  value: string;
  url?: string;
  domain?: string;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  expires?: number;
}

export interface GroupOptions {
  scrollToBottom: boolean;
  waitForSelector?: string;
  crawl: boolean;
  crawl_depth?: number;
  userAgent?: string;
  localStorage?: Record<string, string>;
  cookies?: Cookie[];
  navigationTimeout?: number;
  waitUntil?: 'networkidle' | 'load' | 'domcontentloaded';
  delayMinMs?: number;
  delayMaxMs?: number;
  stealth?: boolean;
  fetchAssets?: boolean;
  screenshot?: boolean;
  checkBrokenLinks?: boolean;
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

export interface Stats {
  statusCounts: Record<string, number>;
  visitsByDay: Array<{ date: string; group: string; count: number }>;
}

// ── Group detail page types ───────────────────────────────────────────────────

export interface GroupOverviewStats {
  totalRuns: number;
  successRate: number;     // 0-100
  avgLoadTimeMs: number;
  avgTtfbMs: number | null;
}

export interface GroupRunSeries {
  runId: number;
  startedAt: string;
  successRate: number;     // 0-100
  avgLoadTimeMs: number;
}

export interface GroupOverview {
  recentRuns: Run[];
  stats: GroupOverviewStats;
  series: GroupRunSeries[];
}

export interface UrlPerformance {
  url: string;
  p50LoadTimeMs: number;
  p95LoadTimeMs: number;
  p50TtfbMs: number | null;
  p95TtfbMs: number | null;
  isSlow: boolean;
  sampleCount: number;
}

export interface LoadTimeTrendPoint {
  runId: number;
  startedAt: string;
  url: string;
  avgLoadTimeMs: number;
}

export interface GroupPerformance {
  urls: UrlPerformance[];
  loadTimeTrend: LoadTimeTrendPoint[];
}

export interface UrlUptime {
  url: string;
  uptimePct: number;
  totalChecks: number;
  downCount: number;
  lastStatus: 'up' | 'down';
  lastCheckedAt: string;
}

export interface UptimeTimelinePoint {
  url: string;
  visitedAt: string;
  isDown: boolean;
}

export interface GroupUptime {
  urls: UrlUptime[];
  timeline: UptimeTimelinePoint[];
}

export interface SeoData {
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  robotsMeta: string | null;
}

export interface UrlSeoHistory {
  visitId: number;
  runId: number;
  visitedAt: string;
  seo: SeoData;
}

export interface UrlSeoSummary {
  url: string;
  latestSeo: SeoData | null;
  score: number;
  issues: string[];
  changed: boolean;
  history: UrlSeoHistory[];
}

export interface GroupSeo {
  urls: UrlSeoSummary[];
}

// ── Phase 3 types ─────────────────────────────────────────────────────────────

export interface BrokenLinkSummary {
  url: string;
  statusCode: number | null;
  error: string | null;
  occurrences: number;
  lastSeenAt: string;
}

export interface GroupStatus {
  groupName: string;
  uptimePct: number;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  urlCount: number;
}
