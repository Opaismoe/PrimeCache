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
  retry_count: number;
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

export interface BasicAuth {
  username: string;
  password: string;
}

export interface GroupOptions {
  scrollToBottom: boolean;
  waitForSelector?: string;
  crawl: boolean;
  crawl_depth?: number;
  userAgent?: string;
  localStorage?: Record<string, string>;
  cookies?: Cookie[];
  basicAuth?: BasicAuth;
  navigationTimeout?: number;
  waitUntil?: 'networkidle' | 'load' | 'domcontentloaded';
  delayMinMs?: number;
  delayMaxMs?: number;
  stealth?: boolean;
  fetchAssets?: boolean;
  screenshot?: boolean;
  checkBrokenLinks?: boolean;
  checkAccessibility?: boolean;
  checkLighthouse?: boolean;
  retryCount?: number;
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
  successRate: number; // 0-100
  avgLoadTimeMs: number;
  avgTtfbMs: number | null;
}

export interface GroupRunSeries {
  runId: number;
  startedAt: string;
  successRate: number; // 0-100
  avgLoadTimeMs: number;
  uptimePct: number; // 0-100
  avgSeoScore: number | null; // 0-100, null if no SEO data
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

export interface UptimeTrendPoint {
  runId: number;
  startedAt: string;
  url: string;
  wasDown: boolean;
}

export interface GroupUptime {
  urls: UrlUptime[];
  timeline: UptimeTimelinePoint[];
  uptimeTrend: UptimeTrendPoint[];
}

export interface SeoData {
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  h2: string | null;
  h3: string | null;
  h4: string | null;
  h5: string | null;
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  robotsMeta: string | null;
  viewportMeta: string | null;
  lang: string | null;
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

// ── CWV types ─────────────────────────────────────────────────────────────────

export type CwvStatus = 'good' | 'needs-improvement' | 'poor';

export interface UrlCwv {
  url: string;
  sampleCount: number;
  lcpP75: number | null;
  fcpP75: number | null;
  clsP75: number | null;
  inpP75: number | null;
  lcpStatus: CwvStatus | null;
  fcpStatus: CwvStatus | null;
  clsStatus: CwvStatus | null;
  inpStatus: CwvStatus | null;
}

export interface CwvTrendPoint {
  runId: number;
  startedAt: string;
  avgLcpMs: number | null;
  avgFcpMs: number | null;
  avgClsScore: number | null;
  avgInpMs: number | null;
}

export interface UrlCwvTrendPoint {
  runId: number;
  startedAt: string;
  url: string;
  avgLcpMs: number | null;
  avgFcpMs: number | null;
  avgClsScore: number | null;
  avgInpMs: number | null;
  avgTtfbMs: number | null;
}

export interface GroupCwv {
  urls: UrlCwv[];
  trend: CwvTrendPoint[];
  urlTrend: UrlCwvTrendPoint[];
}

// ── Accessibility types ────────────────────────────────────────────────────────

export interface ViolationNode {
  html: string;
  target: string[];
  failureSummary: string | undefined;
}

export interface AccessibilityViolation {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  help: string;
  description: string;
  helpUrl: string;
  nodeCount: number;
  nodes: ViolationNode[];
}

export interface UrlAccessibilitySummary {
  url: string;
  latestViolationCount: number;
  latestCriticalCount: number;
  latestSeriousCount: number;
  topViolations: Array<{
    id: string;
    impact: 'critical' | 'serious' | 'moderate' | 'minor';
    help: string;
    helpUrl: string;
    occurrences: number;
  }>;
  latestViolations: AccessibilityViolation[];
}

export interface GroupAccessibility {
  urls: UrlAccessibilitySummary[];
}

// ── Groups health ─────────────────────────────────────────────────────────────

export interface GroupHealthSummary {
  name: string;
  tabs: {
    performance: boolean;
    uptime: boolean;
    seo: boolean;
    links: boolean;
    accessibility: boolean;
  };
}

// ── Lighthouse types ──────────────────────────────────────────────────────────

export interface LighthouseReport {
  performanceScore: number | null;
  accessibilityScore: number | null;
  seoScore: number | null;
  bestPracticesScore: number | null;
  lcpMs: number | null;
  fcpMs: number | null;
  clsScore: number | null;
  tbtMs: number | null;
  speedIndexMs: number | null;
  inpMs: number | null;
  ttfbMs: number | null;
  triggeredBy: 'schedule' | 'manual';
  auditedAt: string;
  failed: boolean;
  error: string | null;
}

export interface LighthouseUrlSummary {
  url: string;
  latestReport: LighthouseReport | null;
}
