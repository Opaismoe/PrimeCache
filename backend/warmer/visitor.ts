import { getBrowser } from '../browser/connection'
import { createContext } from '../browser/context'
import { dismissCookieConsent } from '../browser/cookieConsent'
import { simulateMouseMovement, simulateScroll, simulateReading } from '../browser/stealth'
import { logger } from '../utils/logger'
import type { WarmGroup } from '../config/urls'

export interface VisitResult {
  url: string
  finalUrl: string | null
  statusCode: number | null
  ttfbMs: number | null
  loadTimeMs: number
  consentFound: boolean
  consentStrategy: string | null
  error: string | null
  visitedAt: Date
  discoveredLinks: string[]
}

export async function visitUrl(
  url: string,
  options: WarmGroup['options'],
): Promise<VisitResult> {
  const start = Date.now()
  let context: Awaited<ReturnType<typeof createContext>> | null = null

  try {
    const browser = await getBrowser(options.stealth)
    context = await createContext(browser, options.userAgent)
    const page = await context.newPage()

    // Block static asset downloads when fetchAssets is disabled.
    // Skipping fonts, images, CSS, and JS significantly reduces per-visit
    // bandwidth and duration when only server-side cache warming is needed.
    if (!options.fetchAssets) {
      await page.route(
        /\.(woff2?|ttf|otf|eot|png|jpe?g|gif|webp|avif|ico|svg|css|js|map)(\?.*)?$/i,
        (route) => route.abort(),
      )
    }

    // Inject cookies before the page loads.
    // Playwright requires either `url` or both `domain` + `path`.
    // Default path to "/" when domain is present but path is omitted.
    if (options.cookies?.length) {
      await context.addCookies(
        options.cookies.map((c) =>
          c.domain && !c.path ? { ...c, path: '/' } : c,
        ),
      )
    }

    // Inject localStorage entries before the page loads (runs as init script)
    if (options.localStorage && Object.keys(options.localStorage).length > 0) {
      const entries = options.localStorage
      await page.addInitScript((kv: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v as string)
      }, entries as Record<string, unknown>)
    }

    // Capture TTFB and actual HTTP status code from the first matching response
    let ttfbMs: number | null = null
    let statusCode: number | null = null
    page.on('response', (response) => {
      if (response.url() === url) {
        if (ttfbMs === null) ttfbMs = Date.now() - start
        if (statusCode === null) statusCode = response.status()
      }
    })

    await page.goto(url, { waitUntil: options.waitUntil, timeout: options.navigationTimeout })

    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: 5_000 }).catch(() => {})
    }

    const consentResult = await dismissCookieConsent(page)
    await simulateMouseMovement(page)
    if (options.scrollToBottom) await simulateScroll(page)
    await simulateReading(page)

    const finalUrl = page.url()
    const loadTimeMs = Date.now() - start

    // Extract same-origin links when crawl is enabled
    let discoveredLinks: string[] = []
    if (options.crawl) {
      const baseOrigin = new URL(url).origin
      const hrefs: string[] = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href]'))
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((h) => h.startsWith('http'))
      )
      discoveredLinks = [...new Set(
        hrefs
          .filter((h) => new URL(h).origin === baseOrigin)
          .map((h) => { const u = new URL(h); u.hash = ''; return u.toString() })
      )]
    }

    logger.info({ url, finalUrl, ttfbMs, loadTimeMs, consentFound: consentResult.found, discoveredLinks: discoveredLinks.length }, 'visit complete')

    return {
      url,
      finalUrl,
      statusCode,
      ttfbMs,
      loadTimeMs,
      consentFound: consentResult.found,
      consentStrategy: consentResult.strategy,
      error: null,
      visitedAt: new Date(),
      discoveredLinks,
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    logger.error({ url, error }, 'visit failed')
    return {
      url,
      finalUrl: null,
      statusCode: null,
      ttfbMs: null,
      loadTimeMs: Date.now() - start,
      consentFound: false,
      consentStrategy: null,
      error,
      visitedAt: new Date(),
      discoveredLinks: [],
    }
  } finally {
    await context?.close()
  }
}
