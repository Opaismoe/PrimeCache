import type { Page } from 'playwright'

export interface ConsentResult {
  found: boolean
  strategy: string | null
  durationMs: number
}

const NAMED_STRATEGIES: Array<{ name: string; selector: string }> = [
  { name: 'cookiebot', selector: '#CybotCookiebotDialogBodyButtonAccept' },
  { name: 'onetrust',  selector: '#onetrust-accept-btn-handler' },
  { name: 'trustarc',  selector: '#truste-consent-button' },
]

const GENERIC_SELECTOR =
  'button:is([id*=accept],[class*=accept],[id*=agree],[class*=agree],[id*=cookie],[class*=cookie])'

const GENERIC_TEXT_RE = /^(accept|akkoord|accepteer|agree|allow all|toestaan)/i

async function tryClick(page: Page, selector: string): Promise<boolean> {
  try {
    const locator = page.locator(selector).first()
    const visible = await locator.isVisible()
    if (visible) {
      await locator.click()
      return true
    }
  } catch { /* not found */ }
  return false
}

export async function dismissCookieConsent(page: Page): Promise<ConsentResult> {
  const start = Date.now()

  // 1. Named CMPs
  for (const { name, selector } of NAMED_STRATEGIES) {
    if (await tryClick(page, selector)) {
      await page.waitForTimeout(500 + Math.floor(Math.random() * 500))
      return { found: true, strategy: name, durationMs: Date.now() - start }
    }
  }

  // 2. Generic selector + text match
  try {
    const locator = page.locator(GENERIC_SELECTOR).first()
    if (await locator.isVisible()) {
      await locator.click()
      await page.waitForTimeout(500 + Math.floor(Math.random() * 500))
      return { found: true, strategy: 'generic', durationMs: Date.now() - start }
    }
  } catch { /* not found */ }

  // 3. Shadow DOM pierce
  try {
    const found = await page.evaluate((reSource) => {
      const re = new RegExp(reSource, 'i')
      const all = Array.from(document.querySelectorAll('*'))
      for (const el of all) {
        const shadow = (el as Element & { shadowRoot?: ShadowRoot }).shadowRoot
        if (!shadow) continue
        const btn = shadow.querySelector('button')
        if (btn && re.test(btn.textContent?.trim() ?? '')) {
          (btn as HTMLElement).click()
          return true
        }
      }
      return false
    }, GENERIC_TEXT_RE.source)
    if (found) {
      await page.waitForTimeout(500 + Math.floor(Math.random() * 500))
      return { found: true, strategy: 'shadow-dom', durationMs: Date.now() - start }
    }
  } catch { /* not found */ }

  // 4. iframe-based banners
  try {
    const frames = page.frames()
    for (const frame of frames) {
      const url = frame.url()
      if (!url.includes('consent') && !url.includes('cookie')) continue
      const locator = frame.locator('button').first()
      if (await locator.isVisible()) {
        await locator.click()
        await page.waitForTimeout(500 + Math.floor(Math.random() * 500))
        return { found: true, strategy: 'iframe', durationMs: Date.now() - start }
      }
    }
  } catch { /* not found */ }

  return { found: false, strategy: null, durationMs: Date.now() - start }
}
