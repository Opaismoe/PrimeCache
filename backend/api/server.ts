import Fastify, { type FastifyInstance } from 'fastify'
import fastifyStatic from '@fastify/static'
import { timingSafeEqual } from 'crypto'
import path from 'path'
import type { Knex } from 'knex'
import { env } from '../config/env'
import { logger } from '../utils/logger'
import type { Config } from '../config/urls'
import { getRuns, getRunById, getLatestPerGroup, finalizeRun, deleteRuns } from '../db/queries/runs'
import { getVisitsByRunId } from '../db/queries/visits'
import { getStats } from '../db/queries/stats'
import { runGroup, startRunGroup } from '../warmer/runner'
import { cancelRun } from '../warmer/registry'
import { putConfigRoute } from './routes/config'

interface ServerDeps {
  db: Knex
  getConfig: () => Config
}

export async function buildServer({ db, getConfig }: ServerDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  // ── Static files (React SPA) ──────────────────────────────────────────────
  await app.register(fastifyStatic, {
    // ts-node:  __dirname = backend/api/      → ../../frontend/dist
    // compiled: __dirname = backend/dist/api/ → ../../../frontend/dist
    root: __filename.endsWith('.ts')
      ? path.join(__dirname, '..', '..', 'frontend', 'dist')
      : path.join(__dirname, '..', '..', '..', 'frontend', 'dist'),
    prefix: '/',
  })

  // ── Health (no auth) ──────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }))

  // ── Auth preHandler for all protected routes ──────────────────────────────
  async function requireApiKey(request: any, reply: any) {
    const key = request.headers['x-api-key'] as string | undefined
    if (!key) return reply.code(401).send({ error: 'Unauthorized' })
    try {
      const valid = timingSafeEqual(Buffer.from(key), Buffer.from(env.API_KEY))
      if (!valid) return reply.code(401).send({ error: 'Unauthorized' })
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
  }

  // ── Protected routes ──────────────────────────────────────────────────────
  app.register(async (protected_) => {
    protected_.addHook('preHandler', requireApiKey)

    // GET /runs
    protected_.get('/runs', async (request: any) => {
      const limit  = Number(request.query.limit  ?? 20)
      const offset = Number(request.query.offset ?? 0)
      const group  = (request.query.group as string | undefined) || undefined
      return getRuns(db, { limit, offset, ...(group ? { group } : {}) })
    })

    // GET /runs/latest  — must be registered before /runs/:id
    protected_.get('/runs/latest', async () => getLatestPerGroup(db))

    // GET /runs/:id
    protected_.get('/runs/:id', async (request: any, reply: any) => {
      const run = await getRunById(db, Number(request.params.id))
      if (!run) return reply.code(404).send({ error: 'Run not found' })
      const visits = await getVisitsByRunId(db, run.id)
      return { ...run, visits }
    })

    // POST /trigger (synchronous — waits for completion)
    protected_.post('/trigger', async (request: any, reply: any) => {
      const { group: groupName } = request.body as { group: string }
      const group = getConfig().groups.find((g) => g.name === groupName)
      if (!group) return reply.code(400).send({ error: `Unknown group "${groupName}"` })
      const runId = await runGroup(db, group)
      return { runId }
    })

    // POST /trigger/async — returns runId immediately, runs in background
    protected_.post('/trigger/async', async (request: any, reply: any) => {
      const { group: groupName } = request.body as { group: string }
      const group = getConfig().groups.find((g) => g.name === groupName)
      if (!group) return reply.code(400).send({ error: `Unknown group "${groupName}"` })
      const { runId, promise } = await startRunGroup(db, group)
      promise
        .then(() => logger.info({ group: groupName, runId }, 'async trigger run complete'))
        .catch((err) => logger.error({ group: groupName, runId, err }, 'async trigger run failed'))
      return { runId }
    })

    // POST /webhook/warm
    protected_.post('/webhook/warm', async (request: any, reply: any) => {
      const { group: groupName } = request.body as { group: string }
      const groups = getConfig().groups
      const targets =
        groupName === 'all'
          ? groups
          : groups.filter((g) => g.name === groupName)

      if (!targets.length) return reply.code(400).send({ error: `Unknown group "${groupName}"` })

      // Fire async — respond immediately
      const runIds: number[] = []
      for (const group of targets) {
        runGroup(db, group)
          .then((id) => logger.info({ group: group.name, runId: id }, 'webhook run complete'))
          .catch((err) => logger.error({ group: group.name, err }, 'webhook run failed'))
        runIds.push(-1) // placeholder; real id resolves async
      }

      return { queued: true, runIds }
    })

    // POST /runs/:id/cancel — must be before /runs/:id
    protected_.post('/runs/:id/cancel', async (request: any, reply: any) => {
      const id = Number(request.params.id)
      const run = await getRunById(db, id)
      if (!run) return reply.code(404).send({ error: 'Run not found' })
      if (run.status !== 'running') return reply.code(400).send({ error: 'Run is not in running state' })
      cancelRun(id)
      await finalizeRun(db, id, {
        status: 'cancelled',
        successCount: run.success_count ?? 0,
        failureCount: run.failure_count ?? 0,
      })
      return { ok: true }
    })

    // DELETE /runs — clears history (optional ?group= filter)
    protected_.delete('/runs', async (request: any) => {
      const group = (request.query as any).group as string | undefined
      const deleted = await deleteRuns(db, group ? { group } : undefined)
      return { deleted }
    })

    // GET /stats
    protected_.get('/stats', async () => getStats(db))

    // GET /config
    protected_.get('/config', async () => ({ groups: getConfig().groups }))

    // PUT /config
    protected_.register(putConfigRoute)
  })

  // SPA catch-all: serve index.html for any unmatched non-API path
  app.setNotFoundHandler((_request, reply: any) => {
    reply.sendFile('index.html')
  })

  return app
}
