import type { Browser, BrowserContext } from 'playwright'
import { pickRandomUA } from '../utils/userAgents'

const LOCALES = ['en-US', 'en-GB', 'nl-NL'] as const

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export async function createContext(browser: Browser, userAgent?: string): Promise<BrowserContext> {
  const locale = pickRandom(LOCALES)
  return browser.newContext({
    viewport: {
      width:  1280 + Math.floor(Math.random() * 641),  // 1280–1920
      height:  768 + Math.floor(Math.random() * 313),  //  768–1080
    },
    userAgent: userAgent ?? pickRandomUA(),
    locale,
    timezoneId: 'Europe/Amsterdam',
    extraHTTPHeaders: {
      'Accept-Language': locale === 'nl-NL'
        ? 'nl-NL,nl;q=0.9,en;q=0.8'
        : `${locale},en;q=0.9`,
    },
  })
}
