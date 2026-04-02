import { AxeBuilder } from '@axe-core/playwright';
import { getBrowser } from '../browser/connection';
import { createContext } from '../browser/context';
import { dismissCookieConsent } from '../browser/cookieConsent';
import { simulateMouseMovement, simulateReading, simulateScroll } from '../browser/stealth';
import type { WarmGroup } from '../config/urls';
import { logger } from '../utils/logger';

export interface SeoSnapshot {
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

export interface CwvSnapshot {
  lcpMs: number | null;
  clsScore: number | null;
  inpMs: number | null;
  fcpMs: number | null;
}

/** Set on window inside addInitScript (not in standard Window typings) */
interface WindowWithCwv extends Window {
  __cwv?: {
    lcp: number | null;
    cls: number;
    inp: number | null;
    fcp: number | null;
  };
}

type LayoutShiftEntry = PerformanceEntry & { value: number; hadRecentInput?: boolean };

export interface HeadersSnapshot {
  cacheControl: string | null;
  xCache: string | null;
  cfCacheStatus: string | null;
  age: number | null;
  etag: string | null;
  contentType: string | null;
  xFrameOptions: string | null;
  xContentTypeOptions: string | null;
  strictTransportSecurity: string | null;
  contentSecurityPolicy: string | null;
}

export interface BrokenLink {
  url: string;
  statusCode: number | null;
  error: string | null;
}

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

export interface AccessibilitySnapshot {
  violationCount: number;
  criticalCount: number;
  seriousCount: number;
  violations: AccessibilityViolation[];
}

export interface VisitResult {
  url: string;
  finalUrl: string | null;
  statusCode: number | null;
  ttfbMs: number | null;
  loadTimeMs: number;
  redirectCount: number;
  consentFound: boolean;
  consentStrategy: string | null;
  error: string | null;
  visitedAt: Date;
  discoveredLinks: string[];
  seo: SeoSnapshot | null;
  cwv: CwvSnapshot | null;
  headers: HeadersSnapshot | null;
  screenshotBase64: string | null;
  brokenLinks: BrokenLink[];
  accessibility: AccessibilitySnapshot | null;
}

export async function visitUrl(url: string, options: WarmGroup['options']): Promise<VisitResult> {
  const start = Date.now();
  let context: Awaited<ReturnType<typeof createContext>> | null = null;

  try {
    const browser = await getBrowser(options.stealth);
    context = await createContext(browser, options.userAgent, options.basicAuth);
    const page = await context.newPage();

    // Block static asset downloads when fetchAssets is disabled.
    if (!options.fetchAssets) {
      await page.route(
        /\.(woff2?|ttf|otf|eot|png|jpe?g|gif|webp|avif|ico|svg|css|js|map)(\?.*)?$/i,
        (route) => route.abort(),
      );
    }

    // Inject cookies before the page loads.
    if (options.cookies?.length) {
      await context.addCookies(
        options.cookies.map((c) => (c.domain && !c.path ? { ...c, path: '/' } : c)),
      );
    }

    // Inject localStorage entries before the page loads (runs as init script)
    if (options.localStorage && Object.keys(options.localStorage).length > 0) {
      const entries = options.localStorage;
      await page.addInitScript(
        (kv: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v as string);
        },
        entries as Record<string, unknown>,
      );
    }

    // Inject Core Web Vitals observer before navigation
    await page.addInitScript(() => {
      const w = window as unknown as WindowWithCwv;
      const cwv = {
        lcp: null as number | null,
        cls: 0,
        inp: null as number | null,
        fcp: null as number | null,
      };
      w.__cwv = cwv;
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            cwv.lcp = entry.startTime;
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (_) {
        /* unsupported */
      }
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const ls = entry as LayoutShiftEntry;
            if (!ls.hadRecentInput) {
              cwv.cls = (cwv.cls ?? 0) + ls.value;
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch (_) {
        /* unsupported */
      }
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const ev = entry as PerformanceEventTiming;
            const dur = ev.processingEnd - ev.startTime;
            if (cwv.inp === null || dur > cwv.inp) {
              cwv.inp = dur;
            }
          }
        }).observe({ type: 'event', buffered: true } as PerformanceObserverInit);
      } catch (_) {
        /* unsupported */
      }
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              cwv.fcp = entry.startTime;
            }
          }
        }).observe({ type: 'paint', buffered: true });
      } catch (_) {
        /* unsupported */
      }
    });

    // Capture TTFB, status code, and response headers from the first matching response
    let ttfbMs: number | null = null;
    let statusCode: number | null = null;
    let headers: HeadersSnapshot | null = null;
    page.on('response', (response) => {
      if (response.url() === url) {
        if (ttfbMs === null) ttfbMs = Date.now() - start;
        if (statusCode === null) statusCode = response.status();
        if (headers === null) {
          const h = response.headers();
          const parseAge = (v: string | undefined) => (v ? parseInt(v, 10) || null : null);
          headers = {
            cacheControl: h['cache-control'] ?? null,
            xCache: h['x-cache'] ?? null,
            cfCacheStatus: h['cf-cache-status'] ?? null,
            age: parseAge(h.age),
            etag: h.etag ?? null,
            contentType: h['content-type']?.split(';')[0]?.trim() ?? null,
            xFrameOptions: h['x-frame-options'] ?? null,
            xContentTypeOptions: h['x-content-type-options'] ?? null,
            strictTransportSecurity: h['strict-transport-security'] ?? null,
            contentSecurityPolicy: h['content-security-policy'] ?? null,
          };
        }
      }
    });

    const response = await page.goto(url, {
      waitUntil: options.waitUntil,
      timeout: options.navigationTimeout,
    });

    // Count redirect hops by walking the redirectedFrom chain
    let redirectCount = 0;
    if (response) {
      let req = response.request().redirectedFrom();
      while (req) {
        redirectCount++;
        req = req.redirectedFrom();
      }
    }

    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: 5_000 }).catch(() => {});
    }

    // Read load time from the browser's Navigation Timing API (load event, relative to navigationStart).
    // Falls back to wall-clock only when the timing entry is unavailable (e.g. cross-origin navigation).
    const navTiming = (await page
      .evaluate((): number | null => {
        const nav = performance.getEntriesByType('navigation')[0] as
          | PerformanceNavigationTiming
          | undefined;
        if (nav) {
          if (nav.loadEventEnd > 0) return Math.round(nav.loadEventEnd);
          if (nav.domContentLoadedEventEnd > 0) return Math.round(nav.domContentLoadedEventEnd);
        }
        return null;
      })
      .catch(() => null)) as number | null;
    const loadTimeMs = navTiming ?? Date.now() - start;

    // Collect SEO metadata — never throws, failure returns null
    const seo: SeoSnapshot | null = await page
      .evaluate(() => ({
        title: document.title || null,
        metaDescription:
          document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
        h1: document.querySelector('h1')?.textContent?.trim() ?? null,
        h2:
          Array.from(document.querySelectorAll('h2'))
            .map((el) => el.textContent?.trim())
            .filter(Boolean)
            .join(' | ') || null,
        h3:
          Array.from(document.querySelectorAll('h3'))
            .map((el) => el.textContent?.trim())
            .filter(Boolean)
            .join(' | ') || null,
        h4:
          Array.from(document.querySelectorAll('h4'))
            .map((el) => el.textContent?.trim())
            .filter(Boolean)
            .join(' | ') || null,
        h5:
          Array.from(document.querySelectorAll('h5'))
            .map((el) => el.textContent?.trim())
            .filter(Boolean)
            .join(' | ') || null,
        canonicalUrl: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
        ogTitle:
          document.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? null,
        ogDescription:
          document.querySelector('meta[property="og:description"]')?.getAttribute('content') ??
          null,
        ogImage:
          document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? null,
        robotsMeta: document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null,
        viewportMeta:
          document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? null,
        lang: document.documentElement.getAttribute('lang') ?? null,
      }))
      .catch(() => null);

    // Read CWV values collected by the init script observer
    const cwvRaw = await page
      .evaluate((): WindowWithCwv['__cwv'] | null => {
        const w = window as unknown as WindowWithCwv;
        return w.__cwv ?? null;
      })
      .catch(() => null);
    const cwv: CwvSnapshot | null = cwvRaw
      ? {
          lcpMs: cwvRaw.lcp != null ? Math.round(cwvRaw.lcp) : null,
          clsScore: cwvRaw.cls != null ? cwvRaw.cls : null,
          inpMs: cwvRaw.inp != null ? Math.round(cwvRaw.inp) : null,
          fcpMs: cwvRaw.fcp != null ? Math.round(cwvRaw.fcp) : null,
        }
      : null;

    const consentResult = await dismissCookieConsent(page);
    await simulateMouseMovement(page);
    if (options.scrollToBottom) await simulateScroll(page);
    await simulateReading(page);

    const finalUrl = page.url();

    // Extract same-origin links when crawl is enabled
    let discoveredLinks: string[] = [];
    if (options.crawl) {
      const baseOrigin = new URL(url).origin;
      const hrefs: string[] = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href]'))
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((h) => h.startsWith('http')),
      );
      discoveredLinks = [
        ...new Set(
          hrefs
            .filter((h) => new URL(h).origin === baseOrigin)
            .map((h) => {
              const u = new URL(h);
              u.hash = '';
              return u.toString();
            }),
        ),
      ];
    }

    // Capture screenshot (opt-in)
    let screenshotBase64: string | null = null;
    if (options.screenshot) {
      const buf = await page.screenshot({ type: 'jpeg', quality: 60 }).catch(() => null);
      if (buf) screenshotBase64 = buf.toString('base64');
    }

    logger.info(
      {
        url,
        finalUrl,
        ttfbMs,
        loadTimeMs,
        redirectCount,
        consentFound: consentResult.found,
        discoveredLinks: discoveredLinks.length,
      },
      'visit complete',
    );

    // HEAD-check discovered links for broken link detection (opt-in)
    let brokenLinks: BrokenLink[] = [];
    if (options.checkBrokenLinks && discoveredLinks.length > 0) {
      brokenLinks = await checkBrokenLinks(discoveredLinks);
    }

    // Accessibility audit via axe-core (opt-in)
    let accessibility: AccessibilitySnapshot | null = null;
    if (options.checkAccessibility) {
      try {
        const axeResults = await new AxeBuilder({ page }).analyze();
        accessibility = {
          violationCount: axeResults.violations.length,
          criticalCount: axeResults.violations.filter((v) => v.impact === 'critical').length,
          seriousCount: axeResults.violations.filter((v) => v.impact === 'serious').length,
          violations: axeResults.violations.map((v) => ({
            id: v.id,
            impact: v.impact as AccessibilityViolation['impact'],
            help: v.help,
            description: v.description,
            helpUrl: v.helpUrl,
            nodeCount: v.nodes.length,
            nodes: v.nodes.map((n) => ({
              html: n.html,
              target: n.target as string[],
              failureSummary: n.failureSummary,
            })),
          })),
        };
      } catch {
        // axe error — never abort the visit
      }
    }

    return {
      url,
      finalUrl,
      statusCode,
      ttfbMs,
      loadTimeMs,
      redirectCount,
      consentFound: consentResult.found,
      consentStrategy: consentResult.strategy,
      error: null,
      visitedAt: new Date(),
      discoveredLinks,
      seo,
      cwv,
      headers,
      screenshotBase64,
      brokenLinks,
      accessibility,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ url, error }, 'visit failed');
    return {
      url,
      finalUrl: null,
      statusCode: null,
      ttfbMs: null,
      loadTimeMs: Date.now() - start,
      redirectCount: 0,
      consentFound: false,
      consentStrategy: null,
      error,
      visitedAt: new Date(),
      discoveredLinks: [],
      seo: null,
      cwv: null,
      headers: null,
      screenshotBase64: null,
      brokenLinks: [],
      accessibility: null,
    };
  } finally {
    await context?.close();
  }
}

async function checkBrokenLinks(urls: string[]): Promise<BrokenLink[]> {
  const broken: BrokenLink[] = [];
  await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5_000) });
        if (res.status >= 400) {
          broken.push({ url, statusCode: res.status, error: null });
        }
      } catch (err) {
        broken.push({
          url,
          statusCode: null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );
  return broken;
}
