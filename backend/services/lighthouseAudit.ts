import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface LighthouseResult {
  url: string;
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

function scoreToInt(score: unknown): number | null {
  if (score == null || typeof score !== 'number') return null;
  return Math.round(score * 100);
}

function auditNum(audits: Record<string, unknown>, key: string): number | null {
  const a = audits[key] as { numericValue?: number } | undefined;
  return a?.numericValue != null ? Math.round(a.numericValue) : null;
}

export async function runLighthouseAudit(url: string): Promise<LighthouseResult> {
  const base = wsToHttp(env.BROWSERLESS_WS_URL);
  const endpoint = `${base}/chromium/performance?token=${env.BROWSERLESS_TOKEN}`;

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
    // Self-hosted may return the LH report directly or wrapped in lighthouseStats
    const lh = (body.lighthouseStats ?? body) as {
      categories?: Record<string, { score?: number }>;
      audits?: Record<string, { numericValue?: number }>;
    };

    const categories = lh.categories ?? {};
    const audits = (lh.audits ?? {}) as Record<string, unknown>;

    return {
      url,
      performanceScore: scoreToInt(categories['performance']?.score),
      accessibilityScore: scoreToInt(categories['accessibility']?.score),
      seoScore: scoreToInt(categories['seo']?.score),
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
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ url, error }, 'lighthouse audit failed');
    return {
      url,
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
