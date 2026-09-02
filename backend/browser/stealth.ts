import type { Page } from 'playwright';

export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs));
  return new Promise((r) => setTimeout(r, ms));
}

export async function simulateMouseMovement(page: Page): Promise<void> {
  try {
    const viewport = page.viewportSize() ?? { width: 1280, height: 900 };
    const steps = 4 + Math.floor(Math.random() * 5); // 4–8 moves

    for (let i = 0; i < steps; i++) {
      const x = Math.floor(Math.random() * viewport.width);
      const y = Math.floor(Math.random() * viewport.height);
      await page.mouse.move(x, y, { steps: 8 + Math.floor(Math.random() * 8) });
      await randomDelay(50, 200);
    }

    // No click here: page.mouse.click() is a trusted, OS-level click, so it
    // triggers real default behavior on whatever it lands on (link
    // navigation, form submission, a JS handler) — including an
    // undismissed cookie-consent modal sitting over the click zone. That
    // sent warm runs to unrelated pages instead of warming the intended
    // URL. Mouse movement alone is enough for basic bot-detection evasion;
    // it isn't worth the navigation risk just to sample one INP data point.
  } catch {
    // page closed mid-simulation — safe to ignore
  }
}

export async function simulateScroll(page: Page): Promise<void> {
  try {
    const scrollSteps = 3 + Math.floor(Math.random() * 4); // 3–6 steps

    for (let i = 0; i < scrollSteps; i++) {
      const distance = 100 + Math.floor(Math.random() * 200); // 100–300px
      await page.evaluate((d) => window.scrollBy({ top: d, behavior: 'smooth' }), distance);
      await randomDelay(200, 800);
    }
  } catch {
    // page closed mid-simulation — safe to ignore
  }
}

export async function simulateReading(page: Page): Promise<void> {
  try {
    const ms = 3000 + Math.floor(Math.random() * 5000); // 3–8s
    await page.waitForTimeout(ms);
  } catch {
    // page closed mid-simulation — safe to ignore
  }
}
