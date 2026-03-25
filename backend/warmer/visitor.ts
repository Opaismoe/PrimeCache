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
    const browser = await getBrowser()
    context = await createContext(browser, options.userAgent)
    const page = await context.newPage()

    // Inject localStorage entries before the page loads (runs as init script)
    if (options.localStorage && Object.keys(options.localStorage).length > 0) {
      const entries = options.localStorage
      await page.addInitScript((kv: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v as string)
      }, entries as Record<string, unknown>)
    }

    // Capture TTFB from the first matching response
    let ttfbMs: number | null = null
    page.on('response', (response) => {
      if (response.url() === url && ttfbMs === null) {
        ttfbMs = Date.now() - start
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
      statusCode: 200,   // captured via response event above when available
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
