import { describe, it, expect, beforeEach, vi } from 'vitest'

// We need to re-import the module fresh for each test since it runs at import time
// vi.resetModules() ensures a clean slate

const VALID_ENV = {
  BROWSERLESS_WS_URL: 'ws://browserless:3000/chromium/playwright',
  BROWSERLESS_TOKEN: 'test-token',
  API_KEY: 'a-valid-api-key-at-least-16-chars',
  DATABASE_URL: 'postgres://primecache:test@localhost:5432/primecache',
  CONFIG_PATH: '/app/config/config.yaml',
  PORT: '3000',
  LOG_LEVEL: 'info',
  TIMEZONE: 'Europe/Amsterdam',
}

describe('env', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('parses valid environment variables correctly', async () => {
    vi.stubEnv('BROWSERLESS_WS_URL', VALID_ENV.BROWSERLESS_WS_URL)
    vi.stubEnv('BROWSERLESS_TOKEN', VALID_ENV.BROWSERLESS_TOKEN)
    vi.stubEnv('API_KEY', VALID_ENV.API_KEY)
    vi.stubEnv('DATABASE_URL', VALID_ENV.DATABASE_URL)
    vi.stubEnv('CONFIG_PATH', VALID_ENV.CONFIG_PATH)
    vi.stubEnv('PORT', VALID_ENV.PORT)
    vi.stubEnv('LOG_LEVEL', VALID_ENV.LOG_LEVEL)
    vi.stubEnv('TIMEZONE', VALID_ENV.TIMEZONE)

    const { env } = await import('./env')

    expect(env.BROWSERLESS_WS_URL).toBe(VALID_ENV.BROWSERLESS_WS_URL)
    expect(env.BROWSERLESS_TOKEN).toBe(VALID_ENV.BROWSERLESS_TOKEN)
    expect(env.API_KEY).toBe(VALID_ENV.API_KEY)
    expect(env.PORT).toBe(3000)         // coerced to number
    expect(env.LOG_LEVEL).toBe('info')
  })

  it('coerces PORT string to number', async () => {
    vi.stubEnv('BROWSERLESS_WS_URL', VALID_ENV.BROWSERLESS_WS_URL)
    vi.stubEnv('BROWSERLESS_TOKEN', VALID_ENV.BROWSERLESS_TOKEN)
    vi.stubEnv('API_KEY', VALID_ENV.API_KEY)
    vi.stubEnv('DATABASE_URL', VALID_ENV.DATABASE_URL)
    vi.stubEnv('PORT', '8080')

    const { env } = await import('./env')
    expect(env.PORT).toBe(8080)
    expect(typeof env.PORT).toBe('number')
  })

  it('applies default for PORT when not set', async () => {
    vi.stubEnv('BROWSERLESS_WS_URL', VALID_ENV.BROWSERLESS_WS_URL)
    vi.stubEnv('BROWSERLESS_TOKEN', VALID_ENV.BROWSERLESS_TOKEN)
    vi.stubEnv('API_KEY', VALID_ENV.API_KEY)
    vi.stubEnv('DATABASE_URL', VALID_ENV.DATABASE_URL)
    vi.stubEnv('PORT', '')

    const { env } = await import('./env')
    expect(env.PORT).toBe(3000)
  })

  it('applies default TIMEZONE when not set', async () => {
    vi.stubEnv('BROWSERLESS_WS_URL', VALID_ENV.BROWSERLESS_WS_URL)
    vi.stubEnv('BROWSERLESS_TOKEN', VALID_ENV.BROWSERLESS_TOKEN)
    vi.stubEnv('API_KEY', VALID_ENV.API_KEY)
    vi.stubEnv('DATABASE_URL', VALID_ENV.DATABASE_URL)
    vi.stubEnv('TIMEZONE', '')

    const { env } = await import('./env')
    expect(env.TIMEZONE).toBe('Europe/Amsterdam')
  })

  it('throws when BROWSERLESS_WS_URL is missing', async () => {
    vi.stubEnv('BROWSERLESS_WS_URL', '')
    vi.stubEnv('BROWSERLESS_TOKEN', VALID_ENV.BROWSERLESS_TOKEN)
    vi.stubEnv('API_KEY', VALID_ENV.API_KEY)
    vi.stubEnv('DATABASE_URL', VALID_ENV.DATABASE_URL)

    await expect(import('./env')).rejects.toThrow()
  })

  it('throws when BROWSERLESS_TOKEN is missing', async () => {
    vi.stubEnv('BROWSERLESS_WS_URL', VALID_ENV.BROWSERLESS_WS_URL)
    vi.stubEnv('BROWSERLESS_TOKEN', '')
    vi.stubEnv('API_KEY', VALID_ENV.API_KEY)
    vi.stubEnv('DATABASE_URL', VALID_ENV.DATABASE_URL)

    await expect(import('./env')).rejects.toThrow()
  })

  it('throws when API_KEY is shorter than 16 characters', async () => {
    vi.stubEnv('BROWSERLESS_WS_URL', VALID_ENV.BROWSERLESS_WS_URL)
    vi.stubEnv('BROWSERLESS_TOKEN', VALID_ENV.BROWSERLESS_TOKEN)
    vi.stubEnv('API_KEY', 'tooshort')
    vi.stubEnv('DATABASE_URL', VALID_ENV.DATABASE_URL)

    await expect(import('./env')).rejects.toThrow()
  })

  it('throws when DATABASE_URL is missing', async () => {
    vi.stubEnv('BROWSERLESS_WS_URL', VALID_ENV.BROWSERLESS_WS_URL)
    vi.stubEnv('BROWSERLESS_TOKEN', VALID_ENV.BROWSERLESS_TOKEN)
    vi.stubEnv('API_KEY', VALID_ENV.API_KEY)
    vi.stubEnv('DATABASE_URL', '')

    await expect(import('./env')).rejects.toThrow()
  })

  it('rejects invalid LOG_LEVEL values', async () => {
    vi.stubEnv('BROWSERLESS_WS_URL', VALID_ENV.BROWSERLESS_WS_URL)
    vi.stubEnv('BROWSERLESS_TOKEN', VALID_ENV.BROWSERLESS_TOKEN)
    vi.stubEnv('API_KEY', VALID_ENV.API_KEY)
    vi.stubEnv('DATABASE_URL', VALID_ENV.DATABASE_URL)
    vi.stubEnv('LOG_LEVEL', 'verbose')  // not a valid level

    await expect(import('./env')).rejects.toThrow()
  })
})
