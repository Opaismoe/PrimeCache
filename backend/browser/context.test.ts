import { describe, it, expect, vi } from 'vitest'

const mockContext = { close: vi.fn() }
const mockBrowser = {
  newContext: vi.fn().mockResolvedValue(mockContext),
}

describe('createContext', () => {
  it('creates a new browser context', async () => {
    const { createContext } = await import('./context')
    const ctx = await createContext(mockBrowser as any)
    expect(mockBrowser.newContext).toHaveBeenCalledOnce()
    expect(ctx).toBe(mockContext)
  })

  it('sets a viewport within the expected range', async () => {
    const { createContext } = await import('./context')
    await createContext(mockBrowser as any)
    const options = mockBrowser.newContext.mock.calls[0][0]
    expect(options.viewport.width).toBeGreaterThanOrEqual(1280)
    expect(options.viewport.width).toBeLessThanOrEqual(1920)
    expect(options.viewport.height).toBeGreaterThanOrEqual(768)
    expect(options.viewport.height).toBeLessThanOrEqual(1080)
  })

  it('sets a userAgent string', async () => {
    const { createContext } = await import('./context')
    await createContext(mockBrowser as any)
    const options = mockBrowser.newContext.mock.calls[0][0]
    expect(typeof options.userAgent).toBe('string')
    expect(options.userAgent.length).toBeGreaterThan(0)
  })

  it('sets Accept-Language header', async () => {
    const { createContext } = await import('./context')
    await createContext(mockBrowser as any)
    const options = mockBrowser.newContext.mock.calls[0][0]
    expect(options.extraHTTPHeaders?.['Accept-Language']).toBeTruthy()
  })

  it('rotates locale across multiple calls', async () => {
    const { createContext } = await import('./context')
    const locales = new Set<string>()
    for (let i = 0; i < 30; i++) {
      mockBrowser.newContext.mockResolvedValue(mockContext)
      await createContext(mockBrowser as any)
      locales.add(mockBrowser.newContext.mock.calls.at(-1)![0].locale)
    }
    expect(locales.size).toBeGreaterThan(1)
  })

  it('sets a custom userAgent when provided', async () => {
    const { createContext } = await import('./context')
    await createContext(mockBrowser as any, 'TerraCache/1.0.0')
    const options = mockBrowser.newContext.mock.calls.at(-1)![0]
    expect(options.userAgent).toBe('TerraCache/1.0.0')
  })
})
