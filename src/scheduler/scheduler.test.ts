import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('BROWSERLESS_WS_URL', 'ws://browserless:3000/chromium/playwright')
vi.stubEnv('BROWSERLESS_TOKEN', 'test-token')
vi.stubEnv('API_KEY', 'a-valid-api-key-at-least-16')
vi.stubEnv('TIMEZONE', 'Europe/Amsterdam')

const mockTask = { destroy: vi.fn(), stop: vi.fn(), start: vi.fn() }
vi.mock('node-cron', () => ({
  default: { schedule: vi.fn().mockReturnValue(mockTask) },
}))

vi.mock('../warmer/runner', () => ({ runGroup: vi.fn().mockResolvedValue(1) }))

const group = (name: string, schedule: string) => ({
  name,
  schedule,
  urls: ['https://example.com/'],
  options: { scrollToBottom: false as const },
})

describe('scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTask.destroy.mockClear()
  })

  it('registers one cron job per group', async () => {
    vi.resetModules()
    const cron = (await import('node-cron')).default
    const { registerJobs } = await import('./index')

    registerJobs([group('a', '*/15 * * * *'), group('b', '0 * * * *')], {} as any)
    expect(cron.schedule).toHaveBeenCalledTimes(2)
  })

  it('schedules each job with the correct cron expression', async () => {
    vi.resetModules()
    const cron = (await import('node-cron')).default
    const { registerJobs } = await import('./index')

    registerJobs([group('homepage', '*/15 * * * *')], {} as any)
    expect(cron.schedule).toHaveBeenCalledWith(
      '*/15 * * * *',
      expect.any(Function),
      expect.objectContaining({ timezone: 'Europe/Amsterdam' }),
    )
  })

  it('destroys existing jobs before registering new ones', async () => {
    vi.resetModules()
    const { registerJobs } = await import('./index')

    registerJobs([group('a', '* * * * *')], {} as any)
    registerJobs([group('b', '* * * * *')], {} as any)
    expect(mockTask.destroy).toHaveBeenCalledOnce()
  })

  it('calls runGroup when the cron fires', async () => {
    vi.resetModules()
    const cron = (await import('node-cron')).default
    const { runGroup } = await import('../warmer/runner')
    const { registerJobs } = await import('./index')

    const db = {} as any
    registerJobs([group('homepage', '*/15 * * * *')], db)

    // Extract and invoke the cron callback
    const callback = vi.mocked(cron.schedule).mock.calls[0][1] as () => void
    await callback()
    expect(runGroup).toHaveBeenCalledWith(db, expect.objectContaining({ name: 'homepage' }))
  })
})
