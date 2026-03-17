# Cache Warmer — Todo List

## Status legend
| Status | Meaning |
|--------|---------|
| `[ ] init` | Scoped, not started |
| `[ ] test` | Writing tests (TDD: tests first, code after) |
| `[ ] code` | Tests written — implementing code to make them pass |
| `[ ] review` | Implementation done — reviewing against tests + architecture |
| `[x] done` | Complete and reviewed |

> **TDD rule**: No item may move from `test` → `code` until tests exist and fail for the right reason.
> No item may move from `code` → `review` until all tests pass.

---

## 1. Project scaffold

- [x] init `package.json` + `tsconfig.json` + `pnpm install`
- [x] init `Dockerfile` + `docker-compose.yml`
- [x] init `.env.example`
- [x] init `config.yaml` example file

---

## 2. Config layer

- [x] init `src/config/env.ts` — Zod-validated env vars (hard exit on missing)
- [x] test `src/config/env.ts` — missing required vars exit process, defaults applied, types correct
- [x] code `src/config/env.ts`
- [x] review `src/config/env.ts`

- [x] init `src/config/urls.ts` — config.yaml parser + Zod schema + chokidar watcher
- [x] test `src/config/urls.ts` — valid YAML parses, invalid YAML throws, groups schema enforced
- [x] code `src/config/urls.ts`
- [x] review `src/config/urls.ts`

---

## 3. Utils

- [ ] init `src/utils/logger.ts` — pino instance with pretty dev / JSON prod
- [ ] test `src/utils/logger.ts` — child logger carries context fields
- [ ] code `src/utils/logger.ts`
- [ ] review `src/utils/logger.ts`

- [ ] init `src/utils/userAgents.ts` — curated Chrome UA pool
- [ ] test `src/utils/userAgents.ts` — returns valid UA string, rotates across calls
- [ ] code `src/utils/userAgents.ts`
- [ ] review `src/utils/userAgents.ts`

---

## 4. Database

- [ ] init `src/db/client.ts` — Knex singleton
- [ ] init `src/db/migrations/001_create_runs.ts`
- [ ] init `src/db/migrations/002_create_visits.ts`
- [ ] test `src/db/` — migrations run, tables created, rollback works
- [ ] code `src/db/client.ts` + migrations
- [ ] review `src/db/`

- [ ] init `src/db/queries/runs.ts` — insert/select run records
- [ ] test `src/db/queries/runs.ts` — insert returns id, select returns correct shape
- [ ] code `src/db/queries/runs.ts`
- [ ] review `src/db/queries/runs.ts`

- [ ] init `src/db/queries/visits.ts` — insert/select visit records
- [ ] test `src/db/queries/visits.ts` — bulk insert, query by run_id, error field persisted
- [ ] code `src/db/queries/visits.ts`
- [ ] review `src/db/queries/visits.ts`

---

## 5. Browser layer

- [ ] init `src/browser/connection.ts` — Browserless WS singleton + reconnect
- [ ] test `src/browser/connection.ts` — reconnects on disconnect, clean shutdown on SIGTERM
- [ ] code `src/browser/connection.ts`
- [ ] review `src/browser/connection.ts`

- [ ] init `src/browser/context.ts` — BrowserContext factory (UA, viewport, locale, stealth)
- [ ] test `src/browser/context.ts` — context has correct UA, viewport in range, locale header set
- [ ] code `src/browser/context.ts`
- [ ] review `src/browser/context.ts`

- [ ] init `src/browser/stealth.ts` — mouse movement, scroll, dwell time simulation
- [ ] test `src/browser/stealth.ts` — mouse events emitted, scroll increments within bounds, dwell within range
- [ ] code `src/browser/stealth.ts`
- [ ] review `src/browser/stealth.ts`

- [ ] init `src/browser/cookieConsent.ts` — CMP detection + dismissal
- [ ] test `src/browser/cookieConsent.ts` — each strategy returns `found: true` on mock DOM, returns `found: false` when no banner, shadow DOM pierce works
- [ ] code `src/browser/cookieConsent.ts`
- [ ] review `src/browser/cookieConsent.ts`

---

## 6. Warmer

- [ ] init `src/warmer/visitor.ts` — single URL visit → VisitResult
- [ ] test `src/warmer/visitor.ts` — returns statusCode + ttfb, consent result included, error captured without throwing, context always closed
- [ ] code `src/warmer/visitor.ts`
- [ ] review `src/warmer/visitor.ts`

- [ ] init `src/warmer/runner.ts` — group run orchestration + DB writes
- [ ] test `src/warmer/runner.ts` — run record created, all URLs visited, partial failure status set correctly, between-URL delay applied
- [ ] code `src/warmer/runner.ts`
- [ ] review `src/warmer/runner.ts`

---

## 7. Scheduler

- [ ] init `src/scheduler/index.ts` — node-cron jobs per URL group
- [ ] test `src/scheduler/index.ts` — jobs registered with correct cron expression, config reload registers new jobs
- [ ] code `src/scheduler/index.ts`
- [ ] review `src/scheduler/index.ts`

---

## 8. API

- [ ] init `src/api/server.ts` — Fastify instance + API key preHandler
- [ ] test `src/api/server.ts` — 401 without key, 401 with wrong key, passes with correct key, `/health` requires no key
- [ ] code `src/api/server.ts`
- [ ] review `src/api/server.ts`

- [ ] init `src/api/routes/health.ts` — `GET /health`
- [ ] test `src/api/routes/health.ts` — returns 200 `{ status: 'ok' }`
- [ ] code `src/api/routes/health.ts`
- [ ] review `src/api/routes/health.ts`

- [ ] init `src/api/routes/runs.ts` — `GET /runs`, `GET /runs/:id`, `GET /runs/latest`
- [ ] test `src/api/routes/runs.ts` — pagination works, 404 on unknown id, latest returns one per group
- [ ] code `src/api/routes/runs.ts`
- [ ] review `src/api/routes/runs.ts`

- [ ] init `src/api/routes/trigger.ts` — `POST /trigger`
- [ ] test `src/api/routes/trigger.ts` — unknown group returns 400, known group returns runId, run executes async
- [ ] code `src/api/routes/trigger.ts`
- [ ] review `src/api/routes/trigger.ts`

- [ ] init `src/api/routes/webhook.ts` — `POST /webhook/warm`
- [ ] test `src/api/routes/webhook.ts` — `{ group: "all" }` triggers all groups, responds immediately with runIds, unknown group returns 400
- [ ] code `src/api/routes/webhook.ts`
- [ ] review `src/api/routes/webhook.ts`

- [ ] init `src/api/routes/config.ts` — `GET /config`
- [ ] test `src/api/routes/config.ts` — returns current parsed URL groups
- [ ] code `src/api/routes/config.ts`
- [ ] review `src/api/routes/config.ts`

---

## 9. Entry point

- [ ] init `src/index.ts` — boot sequence: migrations → API → scheduler
- [ ] test `src/index.ts` — boot order enforced (migrations before API), SIGTERM triggers clean shutdown
- [ ] code `src/index.ts`
- [ ] review `src/index.ts`

---

## 10. Deploy

- [ ] init Dockerfile verified with `docker build`
- [ ] init docker-compose local smoke test (health check passes, webhook responds)
- [ ] init Coolify deploy + volumes configured
