import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import type { Browser } from 'playwright'
import { env } from '../config/env'
import { logger } from '../utils/logger'

chromium.use(StealthPlugin())

let browser: Browser | null = null

export async function getBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) return browser
  browser = await connectWithRetry()
  return browser
}

async function connectWithRetry(attempt = 0): Promise<Browser> {
  const wsEndpoint = `${env.BROWSERLESS_WS_URL}?token=${env.BROWSERLESS_TOKEN}`
  try {
    return await (chromium as any).connect(wsEndpoint)
  } catch (err) {
    if (attempt >= 4) throw err
    const delayMs = Math.pow(2, attempt) * 1000
    logger.warn({ attempt, delayMs }, 'Browserless connection failed, retrying...')
    await new Promise((r) => setTimeout(r, delayMs))
    return connectWithRetry(attempt + 1)
  }
}

export async function disconnect(): Promise<void> {
  if (browser) {
    await browser.close()
    browser = null
  }
}
