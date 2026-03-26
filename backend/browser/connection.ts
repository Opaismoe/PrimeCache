import { chromium as chromiumExtra } from 'playwright-extra'
import { chromium as chromiumPlain } from 'playwright'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import type { Browser } from 'playwright'
import { env } from '../config/env'
import { logger } from '../utils/logger'

const stealthPlugin = StealthPlugin()
stealthPlugin.enabledEvasions.delete('user-agent-override')
chromiumExtra.use(stealthPlugin)

let browserStealth: Browser | null = null
let browserPlain: Browser | null = null

export async function getBrowser(useStealth = true): Promise<Browser> {
  if (useStealth) {
    if (browserStealth && browserStealth.isConnected()) return browserStealth
    browserStealth = await connectWithRetry(true)
    return browserStealth
  } else {
    if (browserPlain && browserPlain.isConnected()) return browserPlain
    browserPlain = await connectWithRetry(false)
    return browserPlain
  }
}

async function connectWithRetry(useStealth: boolean, attempt = 0): Promise<Browser> {
  const wsEndpoint = `${env.BROWSERLESS_WS_URL}?token=${env.BROWSERLESS_TOKEN}`
  try {
    const b = useStealth
      ? await (chromiumExtra as any).connect(wsEndpoint)
      : await chromiumPlain.connect(wsEndpoint)
    b.on('disconnected', () => {
      if (useStealth) browserStealth = null
      else browserPlain = null
    })
    return b
  } catch (err) {
    if (attempt >= 4) throw err
    const delayMs = Math.pow(2, attempt) * 1000
    logger.warn({ attempt, delayMs }, 'Browserless connection failed, retrying...')
    await new Promise((r) => setTimeout(r, delayMs))
    return connectWithRetry(useStealth, attempt + 1)
  }
}

export async function resetBrowser(): Promise<void> {
  for (const b of [browserStealth, browserPlain]) {
    if (b) {
      try { await b.close() } catch {}
    }
  }
  browserStealth = null
  browserPlain = null
}

export async function disconnect(): Promise<void> {
  await resetBrowser()
}
