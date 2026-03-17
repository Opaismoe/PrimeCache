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
}

export async function visitUrl(
  url: string,
  options: WarmGroup['options'],
): Promise<VisitResult> {
  const start = Date.now()
  let context: Awaited<ReturnType<typeof createContext>> | null = null

  try {
    const browser = await getBrowser()
    context = await createContext(browser)
    const page = await context.newPage()

    // Capture TTFB from the first matching response
    let ttfbMs: number | null = null
    page.on('response', (response) => {
      if (response.url() === url && ttfbMs === null) {
        ttfbMs = Date.now() - start
      }
    })

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })

    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: 5_000 }).catch(() => {})
    }

    const consentResult = await dismissCookieConsent(page)
    await simulateMouseMovement(page)
    if (options.scrollToBottom) await simulateScroll(page)
    await simulateReading(page)

    const finalUrl = page.url()
    const loadTimeMs = Date.now() - start

    logger.info({ url, finalUrl, ttfbMs, loadTimeMs, consentFound: consentResult.found }, 'visit complete')

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
    }
  } finally {
    await context?.close()
  }
}
