import { timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { env } from '../config/env';
import type { Config } from '../config/urls';
import type { Db } from '../db/client';
import {
  deleteRuns,
  finalizeRun,
  getLatestPerGroup,
  getRunById,
  getRuns,
} from '../db/queries/runs';
import { getStats } from '../db/queries/stats';
import { getScreenshotsByRunId } from '../db/queries/visitScreenshot';
import { getVisitsByRunId } from '../db/queries/visits';
import { logger } from '../utils/logger';
import { cancelRun } from '../warmer/registry';
import { runGroup, startRunGroup } from '../warmer/runner';
import { putConfigRoute } from './routes/config';
import { groupRoutes } from './routes/groups';
import { getGroupUptime as getPublicStatus } from './routes/publicStatus';
import { secretsRoutes } from './routes/secrets';
import { webhookManagementRoutes, webhookTriggerRoute } from './routes/webhooks';

interface ServerDeps {
  db: Db;
  getConfig: () => Config;
}

export async function buildServer({ db, getConfig }: ServerDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // ── Security headers ──────────────────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    strictTransportSecurity: { maxAge: 15552000, includeSubDomains: true },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  });

  // ── Static files (React SPA) ──────────────────────────────────────────────
  await app.register(fastifyStatic, {
    // ts-node:  __dirname = backend/api/      → ../../frontend/dist
    // compiled: __dirname = backend/dist/api/ → ../../../frontend/dist
    root: __filename.endsWith('.ts')
      ? path.join(__dirname, '..', '..', 'frontend', 'dist')
      : path.join(__dirname, '..', '..', '..', 'frontend', 'dist'),
    prefix: '/',
  });

  // ── Global error logging ──────────────────────────────────────────────────
  app.setErrorHandler((error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
    // Redact the webhook trigger token from the URL before logging — the token
    // appears in /webhook/trigger/:token and must not reach log aggregators.
    const safeUrl = _request.url.replace(/(\/webhook\/trigger\/)[^/?#]+/, '$1[REDACTED]');
    logger.error({ err: error, url: safeUrl }, 'unhandled route error');
    reply.code(error.statusCode ?? 500).send({ error: error.message });
  });

  // ── Health (no auth) ──────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));

  // ── Public status (no auth) ───────────────────────────────────────────────
  app.get('/api/public/status', async () => getPublicStatus(db));

  // ── POST /api/auth/login (public) ─────────────────────────────────────────
  app.post<{ Body: { username?: string; password?: string } }>(
    '/api/auth/login',
    async (request, reply) => {
      const { username, password } = request.body ?? {};
      if (!username || !password)
        return reply.code(400).send({ error: 'username and password required' });
      try {
        const usernameMatch = timingSafeEqual(
          Buffer.from(username),
          Buffer.from(env.ADMIN_USERNAME),
        );
        const passwordMatch = timingSafeEqual(
          Buffer.from(password),
          Buffer.from(env.ADMIN_PASSWORD),
        );
        if (!usernameMatch || !passwordMatch)
          return reply.code(401).send({ error: 'Unauthorized' });
      } catch {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      return { token: env.API_KEY };
    },
  );

  // ── Auth preHandler for all protected routes ──────────────────────────────
  async function requireApiKey(request: FastifyRequest, reply: FastifyReply) {
    const key = request.headers['x-api-key'] as string | undefined;
    if (!key) return reply.code(401).send({ error: 'Unauthorized' });
    try {
      const valid = timingSafeEqual(Buffer.from(key), Buffer.from(env.API_KEY));
      if (!valid) return reply.code(401).send({ error: 'Unauthorized' });
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  }

  // ── Protected routes (/api/*) ─────────────────────────────────────────────
  app.register(
    async (protected_) => {
      protected_.addHook('preHandler', requireApiKey);

      // GET /runs
      protected_.get<{ Querystring: { limit?: string; offset?: string; group?: string } }>(
        '/runs',
        async (request) => {
          const limit = Number(request.query.limit ?? 20);
          const offset = Number(request.query.offset ?? 0);
          const group = request.query.group || undefined;
          return getRuns(db, { limit, offset, ...(group ? { group } : {}) });
        },
      );

      // GET /runs/latest  — must be registered before /runs/:id
      protected_.get('/runs/latest', async () => getLatestPerGroup(db));

      // GET /runs/:id
      protected_.get<{ Params: { id: string } }>('/runs/:id', async (request, reply) => {
        const run = await getRunById(db, Number(request.params.id));
        if (!run) return reply.code(404).send({ error: 'Run not found' });
        const visits = await getVisitsByRunId(db, run.id);
        return { ...run, visits };
      });

      // GET /runs/:id/screenshots
      protected_.get<{ Params: { id: string } }>(
        '/runs/:id/screenshots',
        async (request, reply) => {
          const run = await getRunById(db, Number(request.params.id));
          if (!run) return reply.code(404).send({ error: 'Run not found' });
          return getScreenshotsByRunId(db, run.id);
        },
      );

      // POST /trigger (synchronous — waits for completion)
      protected_.post<{ Body: { group: string } }>('/trigger', async (request, reply) => {
        const { group: groupName } = request.body;
        const group = getConfig().groups.find((g) => g.name === groupName);
        if (!group) return reply.code(400).send({ error: `Unknown group "${groupName}"` });
        const runId = await runGroup(db, group);
        return { runId };
      });

      // POST /trigger/async — returns runId immediately, runs in background
      protected_.post<{ Body: { group: string } }>('/trigger/async', async (request, reply) => {
        const { group: groupName } = request.body;
        const group = getConfig().groups.find((g) => g.name === groupName);
        if (!group) return reply.code(400).send({ error: `Unknown group "${groupName}"` });
        const { runId, promise } = await startRunGroup(db, group);
        promise
          .then(() => logger.info({ group: groupName, runId }, 'async trigger run complete'))
          .catch((err) =>
            logger.error({ group: groupName, runId, err }, 'async trigger run failed'),
          );
        return { runId };
      });

      // POST /webhook/warm
      protected_.post<{ Body: { group: string } }>('/webhook/warm', async (request, reply) => {
        const { group: groupName } = request.body;
        const groups = getConfig().groups;
        const targets = groupName === 'all' ? groups : groups.filter((g) => g.name === groupName);

        if (!targets.length) return reply.code(400).send({ error: `Unknown group "${groupName}"` });

        // Fire async — respond immediately
        const runIds: number[] = [];
        for (const group of targets) {
          runGroup(db, group)
            .then((id) => logger.info({ group: group.name, runId: id }, 'webhook run complete'))
            .catch((err) => logger.error({ group: group.name, err }, 'webhook run failed'));
          runIds.push(-1); // placeholder; real id resolves async
        }

        return { queued: true, runIds };
      });

      // POST /runs/:id/cancel — must be before /runs/:id
      protected_.post<{ Params: { id: string } }>('/runs/:id/cancel', async (request, reply) => {
        const id = Number(request.params.id);
        const run = await getRunById(db, id);
        if (!run) return reply.code(404).send({ error: 'Run not found' });
        if (run.status !== 'running')
          return reply.code(400).send({ error: 'Run is not in running state' });
        cancelRun(id);
        await finalizeRun(db, id, {
          status: 'cancelled',
          successCount: run.success_count ?? 0,
          failureCount: run.failure_count ?? 0,
        });
        return { ok: true };
      });

      // DELETE /runs — clears history (optional ?group= filter)
      protected_.delete<{ Querystring: { group?: string } }>('/runs', async (request) => {
        const group = request.query.group;
        const deleted = await deleteRuns(db, group ? { group } : undefined);
        return { deleted };
      });

      // GET /stats
      protected_.get('/stats', async () => getStats(db));

      // GET /config
      protected_.get('/config', async () => ({ groups: getConfig().groups }));

      // PUT /config
      protected_.register(putConfigRoute(db));

      // GET /groups/:name/overview|performance|uptime
      protected_.register(groupRoutes(db, getConfig));

      // Secrets CRUD
      protected_.register(secretsRoutes(db));

      // Webhook token management: GET/POST/DELETE/PATCH /api/groups/:name/webhooks[/:id]
      protected_.register(webhookManagementRoutes(db, getConfig));
    },
    { prefix: '/api' },
  );

  // Inbound webhook trigger (no auth — token in URL is the credential)
  app.register(webhookTriggerRoute(db, getConfig));

  // SPA catch-all: serve index.html for any unmatched non-API path
  app.setNotFoundHandler((_request, reply: FastifyReply) => {
    reply.sendFile('index.html');
  });

  return app;
}
