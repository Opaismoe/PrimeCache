import { describe, it, expect, vi } from 'vitest'
import { simulateMouseMovement, simulateScroll, simulateReading, randomDelay } from './stealth'

function makePage(overrides: Record<string, unknown> = {}) {
  return {
    mouse: { move: vi.fn().mockResolvedValue(undefined) },
    evaluate: vi.fn().mockResolvedValue(undefined),
    viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 900 }),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any
}

describe('simulateMouseMovement', () => {
  it('calls page.mouse.move at least once', async () => {
    const page = makePage()
    await simulateMouseMovement(page)
    expect(page.mouse.move).toHaveBeenCalled()
  })

  it('moves within viewport bounds', async () => {
    const page = makePage()
    await simulateMouseMovement(page)
    for (const [x, y] of page.mouse.move.mock.calls) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(1280)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(900)
    }
  })
})

describe('simulateScroll', () => {
  it('calls page.evaluate to scroll', async () => {
    const page = makePage()
    await simulateScroll(page)
    expect(page.evaluate).toHaveBeenCalled()
  })
})

describe('simulateReading', () => {
  it('waits using page.waitForTimeout', async () => {
    const page = makePage()
    await simulateReading(page)
    expect(page.waitForTimeout).toHaveBeenCalledOnce()
    const ms = page.waitForTimeout.mock.calls[0][0]
    expect(ms).toBeGreaterThanOrEqual(3000)
    expect(ms).toBeLessThanOrEqual(8000)
  })
})

describe('randomDelay', () => {
  it('resolves within the specified range', async () => {
    const start = Date.now()
    await randomDelay(0, 10)
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(100)
  })
})

describe('page-closed resilience', () => {
  it('simulateMouseMovement silently returns when page.mouse.move throws closed error', async () => {
    const page = makePage({
      mouse: { move: vi.fn().mockRejectedValue(new Error('Target page, context or browser has been closed')) },
    })
    await expect(simulateMouseMovement(page)).resolves.toBeUndefined()
  })

  it('simulateScroll silently returns when page.evaluate throws closed error', async () => {
    const page = makePage({
      evaluate: vi.fn().mockRejectedValue(new Error('Target page, context or browser has been closed')),
    })
    await expect(simulateScroll(page)).resolves.toBeUndefined()
  })

  it('simulateReading silently returns when page.waitForTimeout throws closed error', async () => {
    const page = makePage({
      waitForTimeout: vi.fn().mockRejectedValue(new Error('Target page, context or browser has been closed')),
    })
    await expect(simulateReading(page)).resolves.toBeUndefined()
  })
})
