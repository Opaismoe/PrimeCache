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

- [x] init `src/utils/logger.ts` — pino instance with pretty dev / JSON prod
- [x] test `src/utils/logger.ts` — child logger carries context fields
- [x] code `src/utils/logger.ts`
- [x] review `src/utils/logger.ts`

- [x] init `src/utils/userAgents.ts` — curated Chrome UA pool
- [x] test `src/utils/userAgents.ts` — returns valid UA string, rotates across calls
- [x] code `src/utils/userAgents.ts`
- [x] review `src/utils/userAgents.ts`

---

## 4. Database

- [x] init `src/db/client.ts` — Knex singleton
- [x] init `src/db/migrations/001_create_runs.ts`
- [x] init `src/db/migrations/002_create_visits.ts`
- [x] test `src/db/` — migrations run, tables created, rollback works
- [x] code `src/db/client.ts` + migrations
- [x] review `src/db/`

- [x] init `src/db/queries/runs.ts` — insert/select run records
- [x] test `src/db/queries/runs.ts` — insert returns id, select returns correct shape
- [x] code `src/db/queries/runs.ts`
- [x] review `src/db/queries/runs.ts`

- [x] init `src/db/queries/visits.ts` — insert/select visit records
- [x] test `src/db/queries/visits.ts` — bulk insert, query by run_id, error field persisted
- [x] code `src/db/queries/visits.ts`
- [x] review `src/db/queries/visits.ts`

---

## 5. Browser layer

- [x] init `src/browser/connection.ts` — Browserless WS singleton + reconnect
- [x] test `src/browser/connection.ts` — reconnects on disconnect, clean shutdown on SIGTERM
- [x] code `src/browser/connection.ts`
- [x] review `src/browser/connection.ts`

- [x] init `src/browser/context.ts` — BrowserContext factory (UA, viewport, locale, stealth)
- [x] test `src/browser/context.ts` — context has correct UA, viewport in range, locale header set
- [x] code `src/browser/context.ts`
- [x] review `src/browser/context.ts`

- [x] init `src/browser/stealth.ts` — mouse movement, scroll, dwell time simulation
- [x] test `src/browser/stealth.ts` — mouse events emitted, scroll increments within bounds, dwell within range
- [x] code `src/browser/stealth.ts`
- [x] review `src/browser/stealth.ts`

- [x] init `src/browser/cookieConsent.ts` — CMP detection + dismissal
- [x] test `src/browser/cookieConsent.ts` — each strategy returns `found: true` on mock DOM, returns `found: false` when no banner, shadow DOM pierce works
- [x] code `src/browser/cookieConsent.ts`
- [x] review `src/browser/cookieConsent.ts`

---

## 6. Warmer

- [x] init `src/warmer/visitor.ts` — single URL visit → VisitResult
- [x] test `src/warmer/visitor.ts` — returns statusCode + ttfb, consent result included, error captured without throwing, context always closed
- [x] code `src/warmer/visitor.ts`
- [x] review `src/warmer/visitor.ts`

- [x] init `src/warmer/runner.ts` — group run orchestration + DB writes
- [x] test `src/warmer/runner.ts` — run record created, all URLs visited, partial failure status set correctly, between-URL delay applied
- [x] code `src/warmer/runner.ts`
- [x] review `src/warmer/runner.ts`

---

## 7. Scheduler

- [x] init `src/scheduler/index.ts` — node-cron jobs per URL group
- [x] test `src/scheduler/index.ts` — jobs registered with correct cron expression, config reload registers new jobs
- [x] code `src/scheduler/index.ts`
- [x] review `src/scheduler/index.ts`

---

## 8. API

- [x] init `src/api/server.ts` — Fastify instance + API key preHandler
- [x] test `src/api/server.ts` — 401 without key, 401 with wrong key, passes with correct key, `/health` requires no key
- [x] code `src/api/server.ts`
- [x] review `src/api/server.ts`

- [x] init `src/api/routes/health.ts` — `GET /health`
- [x] test `src/api/routes/health.ts` — returns 200 `{ status: 'ok' }`
- [x] code `src/api/routes/health.ts`
- [x] review `src/api/routes/health.ts`

- [x] init `src/api/routes/runs.ts` — `GET /runs`, `GET /runs/:id`, `GET /runs/latest`
- [x] test `src/api/routes/runs.ts` — pagination works, 404 on unknown id, latest returns one per group
- [x] code `src/api/routes/runs.ts`
- [x] review `src/api/routes/runs.ts`

- [x] init `src/api/routes/trigger.ts` — `POST /trigger`
- [x] test `src/api/routes/trigger.ts` — unknown group returns 400, known group returns runId, run executes async
- [x] code `src/api/routes/trigger.ts`
- [x] review `src/api/routes/trigger.ts`

- [x] init `src/api/routes/webhook.ts` — `POST /webhook/warm`
- [x] test `src/api/routes/webhook.ts` — `{ group: "all" }` triggers all groups, responds immediately with runIds, unknown group returns 400
- [x] code `src/api/routes/webhook.ts`
- [x] review `src/api/routes/webhook.ts`

- [x] init `src/api/routes/config.ts` — `GET /config`
- [x] test `src/api/routes/config.ts` — returns current parsed URL groups
- [x] code `src/api/routes/config.ts`
- [x] review `src/api/routes/config.ts`

---

## 9. Entry point

- [x] init `src/index.ts` — boot sequence: migrations → API → scheduler
- [x] test `src/index.ts` — boot order enforced (migrations before API), SIGTERM triggers clean shutdown
- [x] code `src/index.ts`
- [x] review `src/index.ts`

---

## 10. Deploy

- [x] init Dockerfile verified with `docker build`
- [x] init docker-compose local smoke test (health check passes, `/health` responds with `{"status":"ok"}`)
- [ ] init Coolify deploy + volumes configured
