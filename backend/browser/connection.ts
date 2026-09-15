import type { Browser } from 'playwright';
import { chromium as chromiumPlain } from 'playwright';
import { chromium as chromiumExtra } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const stealthPlugin = StealthPlugin();
stealthPlugin.enabledEvasions?.delete('user-agent-override');
chromiumExtra.use(stealthPlugin);

let browserStealth: Browser | null = null;
let browserPlain: Browser | null = null;
// In-flight connects, so concurrent callers share one WS handshake instead of
// each opening a browser and leaking all but the last one.
let connectingStealth: Promise<Browser> | null = null;
let connectingPlain: Promise<Browser> | null = null;

export async function getBrowser(useStealth = true): Promise<Browser> {
  if (useStealth) {
    if (browserStealth?.isConnected()) return browserStealth;
    if (!connectingStealth) {
      connectingStealth = connectWithRetry(true)
        .then((b) => {
          browserStealth = b;
          return b;
        })
        .finally(() => {
          connectingStealth = null;
        });
    }
    return connectingStealth;
  }
  if (browserPlain?.isConnected()) return browserPlain;
  if (!connectingPlain) {
    connectingPlain = connectWithRetry(false)
      .then((b) => {
        browserPlain = b;
        return b;
      })
      .finally(() => {
        connectingPlain = null;
      });
  }
  return connectingPlain;
}

async function connectWithRetry(useStealth: boolean, attempt = 0): Promise<Browser> {
  const wsEndpoint = `${env.BROWSERLESS_WS_URL}?token=${env.BROWSERLESS_TOKEN}`;
  try {
    const b = useStealth
      ? await (chromiumExtra as typeof chromiumPlain).connect(wsEndpoint)
      : await chromiumPlain.connect(wsEndpoint);
    b.on('disconnected', () => {
      if (useStealth) browserStealth = null;
      else browserPlain = null;
    });
    return b;
  } catch (err) {
    if (attempt >= 4) throw err;
    const delayMs = 2 ** attempt * 1000;
    logger.warn({ attempt, delayMs }, 'Browserless connection failed, retrying...');
    await new Promise((r) => setTimeout(r, delayMs));
    return connectWithRetry(useStealth, attempt + 1);
  }
}

export async function resetBrowser(): Promise<void> {
  for (const b of [browserStealth, browserPlain]) {
    if (b) {
      try {
        await b.close();
        // Intentional: best-effort cleanup during shutdown — do not log or throw
      } catch {}
    }
  }
  browserStealth = null;
  browserPlain = null;
}

export async function disconnect(): Promise<void> {
  await resetBrowser();
}
