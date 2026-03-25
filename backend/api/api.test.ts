import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.stubEnv('BROWSERLESS_WS_URL', 'ws://browserless:3000/chromium/playwright')
vi.stubEnv('BROWSERLESS_TOKEN', 'test-token')
vi.stubEnv('API_KEY', 'supersecretapikey1234')
vi.stubEnv('CONFIG_PATH', '/tmp/test-config.yaml')

vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
}))

vi.mock('../warmer/runner', () => ({
  runGroup: vi.fn().mockResolvedValue(42),
  startRunGroup: vi.fn().mockResolvedValue({ runId: 42, promise: Promise.resolve() }),
}))
vi.mock('../scheduler/index', () => ({ registerJobs: vi.fn() }))
vi.mock('../db/queries/runs', () => ({
  getRuns: vi.fn().mockResolvedValue([]),
  getRunById: vi.fn().mockResolvedValue(null),
  getLatestPerGroup: vi.fn().mockResolvedValue([]),
  finalizeRun: vi.fn().mockResolvedValue(undefined),
  deleteRuns: vi.fn().mockResolvedValue(3),
}))
vi.mock('../warmer/registry', () => ({
  cancelRun: vi.fn().mockReturnValue(true),
}))
vi.mock('../db/queries/visits', () => ({
  getVisitsByRunId: vi.fn().mockResolvedValue([]),
}))

const mockConfig = {
  groups: [
    { name: 'homepage', schedule: '*/15 * * * *', urls: ['https://example.com/'], options: { scrollToBottom: false, crawl: false } },
  ],
}

let app: FastifyInstance

beforeEach(async () => {
  vi.resetModules()
  const { buildServer } = await import('./server')
  app = await buildServer({ db: {} as any, getConfig: () => mockConfig })
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

// ── / (static files) ─────────────────────────────────────────────────────────

describe('GET /', () => {
  it('returns 200 with HTML content', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/html/)
  })
})

// ── /health ──────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 without API key', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('ok')
  })
})

// ── Auth ──────────────────────────────────────────────────────────────────────

describe('API key auth', () => {
  it('returns 401 with no key', async () => {
    const res = await app.inject({ method: 'GET', url: '/runs' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 with wrong key', async () => {
    const res = await app.inject({ method: 'GET', url: '/runs', headers: { 'x-api-key': 'wrong' } })
    expect(res.statusCode).toBe(401)
  })

  it('passes with correct key', async () => {
    const res = await app.inject({ method: 'GET', url: '/runs', headers: { 'x-api-key': 'supersecretapikey1234' } })
    expect(res.statusCode).not.toBe(401)
  })
})

// ── /runs ─────────────────────────────────────────────────────────────────────

describe('GET /runs', () => {
  it('returns paginated results', async () => {
    const res = await app.inject({ method: 'GET', url: '/runs?limit=5&offset=0', headers: { 'x-api-key': 'supersecretapikey1234' } })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
  })

  it('passes group filter to getRuns when ?group= is provided', async () => {
    const { getRuns } = await import('../db/queries/runs')
    const res = await app.inject({
      method: 'GET', url: '/runs?group=homepage',
      headers: { 'x-api-key': 'supersecretapikey1234' },
    })
    expect(res.statusCode).toBe(200)
    expect(vi.mocked(getRuns)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ group: 'homepage' }),
    )
  })

  it('does not pass group when ?group= is absent', async () => {
    const { getRuns } = await import('../db/queries/runs')
    vi.mocked(getRuns).mockClear()
    await app.inject({ method: 'GET', url: '/runs', headers: { 'x-api-key': 'supersecretapikey1234' } })
    expect(vi.mocked(getRuns)).toHaveBeenCalledWith(
      expect.anything(),
      expect.not.objectContaining({ group: expect.anything() }),
    )
  })
})

describe('GET /runs/:id', () => {
  it('returns 404 for unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: '/runs/99999', headers: { 'x-api-key': 'supersecretapikey1234' } })
    expect(res.statusCode).toBe(404)
  })
})

describe('GET /runs/latest', () => {
  it('returns an array', async () => {
    const res = await app.inject({ method: 'GET', url: '/runs/latest', headers: { 'x-api-key': 'supersecretapikey1234' } })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
  })
})

// ── /trigger ──────────────────────────────────────────────────────────────────

describe('POST /trigger', () => {
  it('returns 400 for unknown group', async () => {
    const res = await app.inject({
      method: 'POST', url: '/trigger',
      headers: { 'x-api-key': 'supersecretapikey1234', 'content-type': 'application/json' },
      body: JSON.stringify({ group: 'nonexistent' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns runId for known group', async () => {
    const res = await app.inject({
      method: 'POST', url: '/trigger',
      headers: { 'x-api-key': 'supersecretapikey1234', 'content-type': 'application/json' },
      body: JSON.stringify({ group: 'homepage' }),
    })
    expect(res.statusCode).toBe(200)
    expect(typeof res.json().runId).toBe('number')
  })
})

// ── /webhook/warm ─────────────────────────────────────────────────────────────

describe('POST /webhook/warm', () => {
  it('triggers a specific group and returns runIds', async () => {
    const res = await app.inject({
      method: 'POST', url: '/webhook/warm',
      headers: { 'x-api-key': 'supersecretapikey1234', 'content-type': 'application/json' },
      body: JSON.stringify({ group: 'homepage' }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().queued).toBe(true)
    expect(Array.isArray(res.json().runIds)).toBe(true)
  })

  it('triggers all groups when group is "all"', async () => {
    const res = await app.inject({
      method: 'POST', url: '/webhook/warm',
      headers: { 'x-api-key': 'supersecretapikey1234', 'content-type': 'application/json' },
      body: JSON.stringify({ group: 'all' }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().runIds).toHaveLength(1) // 1 group in mockConfig
  })

  it('returns 400 for unknown group', async () => {
    const res = await app.inject({
      method: 'POST', url: '/webhook/warm',
      headers: { 'x-api-key': 'supersecretapikey1234', 'content-type': 'application/json' },
      body: JSON.stringify({ group: 'nonexistent' }),
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── /config ───────────────────────────────────────────────────────────────────

describe('GET /config', () => {
  it('returns current URL groups', async () => {
    const res = await app.inject({ method: 'GET', url: '/config', headers: { 'x-api-key': 'supersecretapikey1234' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().groups).toHaveLength(1)
    expect(res.json().groups[0].name).toBe('homepage')
  })
})

// ── PUT /config ───────────────────────────────────────────────────────────────

const validConfigBody = {
  groups: [{
    name: 'homepage',
    schedule: '*/15 * * * *',
    urls: ['https://example.com/'],
    options: { scrollToBottom: false, crawl: false },
  }],
}

describe('PUT /config', () => {
  it('returns 200 and { ok: true } on valid payload', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/config',
      headers: { 'x-api-key': 'supersecretapikey1234', 'content-type': 'application/json' },
      body: JSON.stringify(validConfigBody),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })

  it('returns 400 when groups array is missing', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/config',
      headers: { 'x-api-key': 'supersecretapikey1234', 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().issues).toBeDefined()
  })

  it('returns 400 when a URL is invalid', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/config',
      headers: { 'x-api-key': 'supersecretapikey1234', 'content-type': 'application/json' },
      body: JSON.stringify({
        groups: [{ ...validConfigBody.groups[0], urls: ['not-a-url'] }],
      }),
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().issues).toBeDefined()
  })

  it('returns 400 when crawl is true but crawl_depth is missing', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/config',
      headers: { 'x-api-key': 'supersecretapikey1234', 'content-type': 'application/json' },
      body: JSON.stringify({
        groups: [{ ...validConfigBody.groups[0], options: { scrollToBottom: false, crawl: true } }],
      }),
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().issues).toBeDefined()
  })

  it('returns 401 without API key', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/config',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validConfigBody),
    })
    expect(res.statusCode).toBe(401)
  })
})

// ── POST /runs/:id/cancel ─────────────────────────────────────────────────────

describe('POST /runs/:id/cancel', () => {
  it('returns 404 for unknown run', async () => {
    const res = await app.inject({
      method: 'POST', url: '/runs/99999/cancel',
      headers: { 'x-api-key': 'supersecretapikey1234' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 when run is not running', async () => {
    const { getRunById } = await import('../db/queries/runs')
    vi.mocked(getRunById).mockResolvedValueOnce({
      id: 1, group_name: 'homepage', started_at: '', ended_at: '',
      status: 'completed', total_urls: 1, success_count: 1, failure_count: 0,
    } as any)
    const res = await app.inject({
      method: 'POST', url: '/runs/1/cancel',
      headers: { 'x-api-key': 'supersecretapikey1234' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 200 and cancels a running run', async () => {
    const { getRunById } = await import('../db/queries/runs')
    vi.mocked(getRunById).mockResolvedValueOnce({
      id: 1, group_name: 'homepage', started_at: '', ended_at: null,
      status: 'running', total_urls: 1, success_count: null, failure_count: null,
    } as any)
    const res = await app.inject({
      method: 'POST', url: '/runs/1/cancel',
      headers: { 'x-api-key': 'supersecretapikey1234' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })
})

// ── POST /trigger/async ───────────────────────────────────────────────────────

describe('POST /trigger/async', () => {
  it('returns 400 for unknown group', async () => {
    const res = await app.inject({
      method: 'POST', url: '/trigger/async',
      headers: { 'x-api-key': 'supersecretapikey1234', 'content-type': 'application/json' },
      body: JSON.stringify({ group: 'nonexistent' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns runId immediately for known group', async () => {
    const res = await app.inject({
      method: 'POST', url: '/trigger/async',
      headers: { 'x-api-key': 'supersecretapikey1234', 'content-type': 'application/json' },
      body: JSON.stringify({ group: 'homepage' }),
    })
    expect(res.statusCode).toBe(200)
    expect(typeof res.json().runId).toBe('number')
  })
})

// ── DELETE /runs ──────────────────────────────────────────────────────────────

describe('DELETE /runs', () => {
  it('returns 401 without API key', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/runs' })
    expect(res.statusCode).toBe(401)
  })

  it('deletes all runs and returns count', async () => {
    const res = await app.inject({
      method: 'DELETE', url: '/runs',
      headers: { 'x-api-key': 'supersecretapikey1234' },
    })
    expect(res.statusCode).toBe(200)
    expect(typeof res.json().deleted).toBe('number')
  })

  it('deletes runs for a specific group with ?group= param', async () => {
    const res = await app.inject({
      method: 'DELETE', url: '/runs?group=homepage',
      headers: { 'x-api-key': 'supersecretapikey1234' },
    })
    expect(res.statusCode).toBe(200)
    expect(typeof res.json().deleted).toBe('number')
  })
})
