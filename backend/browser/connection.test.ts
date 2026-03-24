import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stub env vars before any module imports so Zod validation passes
vi.stubEnv('BROWSERLESS_WS_URL', 'ws://browserless:3000/chromium/playwright')
vi.stubEnv('BROWSERLESS_TOKEN', 'test-token')
vi.stubEnv('API_KEY', 'a-valid-api-key-at-least-16')

const mockBrowser = {
  isConnected: vi.fn().mockReturnValue(true),
  close: vi.fn().mockResolvedValue(undefined),
}

vi.mock('playwright-extra', () => ({
  chromium: {
    use: vi.fn(),
    connect: vi.fn().mockResolvedValue(mockBrowser),
  },
}))

vi.mock('puppeteer-extra-plugin-stealth', () => ({ default: vi.fn(() => ({})) }))

describe('connection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBrowser.isConnected.mockReturnValue(true)
  })

  it('getBrowser connects to Browserless and returns a browser', async () => {
    vi.resetModules()
    const { chromium } = await import('playwright-extra')
    const { getBrowser } = await import('./connection')
    const browser = await getBrowser()
    expect(chromium.connect).toHaveBeenCalledOnce()
    expect(browser).toBe(mockBrowser)
  })

  it('getBrowser reuses existing connected browser', async () => {
    vi.resetModules()
    const { chromium } = await import('playwright-extra')
    const { getBrowser } = await import('./connection')
    await getBrowser()
    await getBrowser()
    expect(chromium.connect).toHaveBeenCalledOnce()
  })

  it('getBrowser reconnects when browser is disconnected', async () => {
    vi.resetModules()
    const { chromium } = await import('playwright-extra')
    const { getBrowser } = await import('./connection')
    // First call connects, sets singleton
    await getBrowser()
    // Now mark as disconnected
    mockBrowser.isConnected.mockReturnValue(false)
    await getBrowser()
    expect(chromium.connect).toHaveBeenCalledTimes(2)
  })

  it('disconnect closes the browser and clears the singleton', async () => {
    vi.resetModules()
    const { getBrowser, disconnect } = await import('./connection')
    await getBrowser()
    await disconnect()
    expect(mockBrowser.close).toHaveBeenCalledOnce()
  })
})
