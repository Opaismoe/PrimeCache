import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface LighthouseResult {
  url: string;
  formFactor: 'mobile' | 'desktop';
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
  failed: boolean;
  error: string | null;
}

function wsToHttp(wsUrl: string): string {
  return wsUrl
    .replace(/^wss:\/\//, 'https://')
    .replace(/^ws:\/\//, 'http://')
    .replace(/\/chromium\/playwright.*$/, '');
}

function lighthouseBaseUrl(): string {
  // BROWSERLESS_HTTP_URL lets you point directly at the internal Browserless host,
  // bypassing any Cloudflare / reverse-proxy that only passes WebSocket traffic.
  // e.g. BROWSERLESS_HTTP_URL=http://browserless:3000
  return env.BROWSERLESS_HTTP_URL ?? wsToHttp(env.BROWSERLESS_WS_URL);
}

function scoreToInt(score: unknown): number | null {
  if (score == null || typeof score !== 'number') return null;
  return Math.round(score * 100);
}

function auditNum(audits: Record<string, unknown>, key: string): number | null {
  const a = audits[key] as { numericValue?: number } | undefined;
  return a?.numericValue != null ? Math.round(a.numericValue) : null;
}

export async function runLighthouseAudit(
  url: string,
  formFactor: 'mobile' | 'desktop' = 'desktop',
  cookies?: Array<{ name: string; value: string; domain: string; path: string }>,
): Promise<LighthouseResult> {
  const base = lighthouseBaseUrl();
  const endpoint = `${base}/chromium/performance?token=${env.BROWSERLESS_TOKEN}&timeout=120000`;
  logger.debug(
    { url, base, formFactor, cookieCount: cookies?.length ?? 0 },
    'running lighthouse audit',
  );

  // Forward cookies from the Playwright warm visit so CF clearance (cf_clearance) transfers.
  // Also add realistic browser headers to reduce bot detection signal.
  const cookieHeader = cookies?.length
    ? cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    : undefined;
  const extraHeaders: Record<string, string> = {
    'Accept-Language': 'en-US,en;q=0.9,nl;q=0.8',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  };
  if (cookieHeader) extraHeaders.Cookie = cookieHeader;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        config: {
          extends: 'lighthouse:default',
          settings: {
            onlyCategories: ['performance', 'accessibility', 'seo', 'best-practices'],
            extraHeaders,
            ...(formFactor === 'desktop'
              ? {
                  formFactor: 'desktop',
                  screenEmulation: {
                    mobile: false,
                    width: 1350,
                    height: 940,
                    deviceScaleFactor: 1,
                    disabled: false,
                  },
                  throttling: {
                    rttMs: 40,
                    throughputKbps: 10240,
                    cpuSlowdownMultiplier: 1,
                    requestLatencyMs: 0,
                    downloadThroughputKbps: 0,
                    uploadThroughputKbps: 0,
                  },
                }
              : {
                  // Mobile: Lighthouse default (Moto G4, throttled 4G)
                  formFactor: 'mobile',
                }),
          },
        },
      }),
      signal: AbortSignal.timeout(120_000), // Lighthouse can take up to 2 min
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Browserless /chromium/performance returned ${res.status}: ${text}`);
    }

    const body = (await res.json()) as Record<string, unknown>;
    logger.debug(
      { url, responseKeys: Object.keys(body), hasLighthouseStats: 'lighthouseStats' in body },
      'lighthouse response structure',
    );
    // Self-hosted Browserless may wrap the report in lighthouseStats, data, or return it directly
    const lh = (body.lighthouseStats ?? body.data ?? body) as {
      categories?: Record<string, { score?: number }>;
      audits?: Record<string, { numericValue?: number }>;
    };

    const categories = lh.categories ?? {};
    const audits = (lh.audits ?? {}) as Record<string, unknown>;

    return {
      url,
      formFactor,
      performanceScore: scoreToInt(categories.performance?.score),
      accessibilityScore: scoreToInt(categories.accessibility?.score),
      seoScore: scoreToInt(categories.seo?.score),
      bestPracticesScore: scoreToInt(categories['best-practices']?.score),
      lcpMs: auditNum(audits, 'largest-contentful-paint'),
      fcpMs: auditNum(audits, 'first-contentful-paint'),
      clsScore: (() => {
        const a = audits['cumulative-layout-shift'] as { numericValue?: number } | undefined;
        return a?.numericValue != null ? Math.round(a.numericValue * 1000) / 1000 : null;
      })(),
      tbtMs: auditNum(audits, 'total-blocking-time'),
      speedIndexMs: auditNum(audits, 'speed-index'),
      inpMs: auditNum(audits, 'interaction-to-next-paint'),
      ttfbMs: auditNum(audits, 'server-response-time'),
      failed: false,
      error: null,
    };
  } catch (err) {
    // Unwrap the root cause — Node's fetch wraps connection errors in a TypeError
    // whose message is just "fetch failed", hiding the real reason (ECONNREFUSED etc.)
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause : null;
    const error = cause
      ? `${err instanceof Error ? err.message : String(err)}: ${cause.message}`
      : err instanceof Error
        ? err.message
        : String(err);
    logger.error({ url, endpoint, error }, 'lighthouse audit failed');
    return {
      url,
      formFactor,
      performanceScore: null,
      accessibilityScore: null,
      seoScore: null,
      bestPracticesScore: null,
      lcpMs: null,
      fcpMs: null,
      clsScore: null,
      tbtMs: null,
      speedIndexMs: null,
      inpMs: null,
      ttfbMs: null,
      failed: true,
      error,
    };
  }
}
