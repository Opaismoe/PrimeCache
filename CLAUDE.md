# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git workflow
- Branch per feature: `feature/<name>` or `fix/<name>` — never commit directly to `main`
- Small, focused commits — one logical change per commit
- Conventional Commits: `feat(scope): summary`, `fix(scope): summary`, `test(scope): summary`, `chore: summary`
- Commit after tests pass, commit after implementation passes, commit after each bug fix — not all at once

## Development workflow (TDD — enforced)

All work follows the states in `.ai/todo.md`: **init → test → code → review → done**.

- **Write tests before implementation.** Tests must fail before you write any code.
- **Never move to `code` state** until tests exist and fail for the right reason.
- **Never move to `review` state** until all tests pass.
- Test files live alongside source: `backend/config/env.test.ts` next to `backend/config/env.ts`.
- Use PGlite (in-memory PostgreSQL) for DB tests — never mock the query layer itself.
- Mock only external I/O: Browserless WS, filesystem. Never mock the module under test.
- After completing a task, update its status in `.ai/todo.md`.

## Commands

Run from the repo root:

```bash
pnpm dev           # backend in watch mode (ts-node-dev)
pnpm build         # tsc backend + vite frontend → dist/
pnpm start         # node dist/index.js (production)
pnpm typecheck     # tsc --noEmit (all packages)
pnpm lint          # biome check (all packages)
pnpm test          # vitest run (all packages)
pnpm test:watch    # vitest watch (all packages)
```

Run a single test file:
```bash
pnpm --filter primecache-backend test warmer/runner.test.ts
```

Docker:
```bash
docker-compose up          # local dev (requires external Browserless — see env vars)
docker-compose up --build  # rebuild image
```

## Environment variables

Required (no defaults):
- `BROWSERLESS_WS_URL` — e.g. `ws://browserless:3000/chromium/playwright`
- `BROWSERLESS_TOKEN` — auth token for your Browserless instance
- `API_KEY` — minimum 16 characters
- `SECRET_ENCRYPTION_KEY` — 64-character hex string (32 bytes); generate with `openssl rand -hex 32`
- `DATABASE_URL` — PostgreSQL connection string, e.g. `postgres://primecache:<password>@postgres:5432/primecache`
- `POSTGRES_PASSWORD` — password for the PostgreSQL Docker service
- `ADMIN_USERNAME` — username for the dashboard login screen
- `ADMIN_PASSWORD` — minimum 8 characters

Optional (defaults shown):
- `BROWSERLESS_HTTP_URL` — direct HTTP base URL for Lighthouse audits, e.g. `http://browserless:3000`. Use this when `BROWSERLESS_WS_URL` points to a public domain behind Cloudflare (CF passes WS but blocks HTTP). Defaults to deriving from `BROWSERLESS_WS_URL`.
- `CONFIG_PATH=/app/config/config.yaml`
- `PORT=3000`
- `LOG_LEVEL=info` (trace|debug|info|warn|error)
- `TIMEZONE=Europe/Amsterdam`
- `BETWEEN_URLS_MIN_MS=2000` / `BETWEEN_URLS_MAX_MS=5000`

## Architecture

`backend/index.ts` boots in four sequential steps: run Drizzle migrations → load and resolve config → start Fastify API → register node-cron schedulers.

### Data flow for a warm run
1. **Trigger**: either node-cron (scheduled) or `POST /api/trigger` / `POST /webhook/warm` (on-demand)
2. `scheduler/index.ts` or `api/routes/` calls `warmer/runner.ts`
3. `runner.ts` creates a `Run` DB record, loops over URLs with random delays (2–5s between each), calls `warmer/visitor.ts` per URL, then finalises the run record
4. `visitor.ts` creates a fresh `BrowserContext` (via `browser/context.ts`), navigates, dismisses consent, simulates user behaviour, captures metrics, closes the context, returns `VisitResult`
5. `runner.ts` bulk-inserts all `VisitResult` rows as `Visit` DB records

### Browserless connection
Always use Playwright **native** WS protocol — not CDP:
```typescript
const browser = await chromium.connect(`${env.BROWSERLESS_WS_URL}?token=${env.BROWSERLESS_TOKEN}`)
```
Endpoint format: `ws://<browserless-host>/chromium/playwright`

`browser/connection.ts` holds a singleton `Browser` with auto-reconnect (exponential backoff, max 5 retries). `getBrowser()` is the only entry point — never call `chromium.connect()` directly outside this module.

### Browser contexts
Create one `BrowserContext` per URL visit for full isolation (cookies, storage). Always close in `finally`. The context factory in `browser/context.ts` applies stealth, random viewport (1280–1920 × 768–1080), rotating user agents, and locale headers.

### Config loading
- `backend/config/env.ts` — Zod-parses `process.env` at startup. Hard exit if any required var is missing.
- `backend/config/urls.ts` — Parses and Zod-validates `config.yaml`. Uses chokidar to watch for file changes and hot-reloads the scheduler without restarting the process.

### Secrets store
Credentials in `config.yaml` (basicAuth, cookies, userAgent) can reference encrypted secrets stored in PostgreSQL using `secret:name` syntax. Secrets are AES-256-GCM encrypted at rest; the master key lives in `SECRET_ENCRYPTION_KEY`.

Manage secrets via the API (all require `X-API-Key`):
- `GET /api/secrets` — list secret names
- `POST /api/secrets` body `{ name, value }` — create or update
- `DELETE /api/secrets/:name` — remove

Resolution happens after `loadConfig()` at startup and on every config hot-reload. If a referenced secret is missing, the process logs an error and keeps the previous config.

`config.yaml` group options:
```yaml
options:
  scrollToBottom: true        # scroll to page bottom after load
  waitForSelector: "main"     # wait for CSS selector before measuring
  crawl: true                 # BFS crawl — discover and visit internal links
  crawl_depth: 2              # required when crawl: true; max 10
  crawl_timeout_ms: 3600000   # max ms the entire run may take before auto-cancel (default 3600000 = 1h; min 60000)
  userAgent: "MyBot/1.0"      # override the rotating user agent for this group
```

### API routes

All routes except `GET /health`, `GET /api/public/status`, and `POST /api/auth/login` require `X-API-Key` header.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check — no auth |
| GET | `/api/public/status` | Per-group uptime for last 30 days — no auth |
| POST | `/api/auth/login` | Exchange `{ username, password }` for `{ token }` — no auth |
| GET | `/api/runs` | Paginated run history (`?limit=20&offset=0&group=<name>`) |
| GET | `/api/runs/latest` | Latest run per group |
| GET | `/api/runs/:id` | Run detail with visits |
| POST | `/api/trigger` | **Synchronous** — runs group, blocks until done, returns `{ runId }` |
| POST | `/api/trigger/async` | **Async** — fires run, returns `{ runId }` immediately |
| POST | `/webhook/warm` | **Async webhook** — `{ "group": "<name>" }`, use `"all"` for every group |
| POST | `/api/runs/:id/cancel` | Cancel a running execution |
| DELETE | `/api/runs` | Clear run history (`?group=<name>` to scope) |
| GET | `/api/config` | Current loaded config |
| PUT | `/api/config` | Update config and rename groups |
| GET | `/api/groups/:name/overview` | Summary stats and per-run trend series |
| GET | `/api/groups/:name/performance` | P50/P95 load time & TTFB per URL + trend |
| GET | `/api/groups/:name/uptime` | Uptime % per URL over last 30 days |
| GET | `/api/groups/:name/seo` | SEO scores and metadata per URL |
| GET | `/api/groups/:name/cwv` | Core Web Vitals at P75 per URL + trend |
| GET | `/api/groups/:name/broken-links` | Broken links discovered during visits |
| GET | `/api/groups/:name/export` | CSV export (`?tab=performance\|uptime\|seo\|links`) |
| GET | `/api/stats` | Global stats: run status breakdown, visits per day per group |
| GET | `/api/secrets` | List secret names (no values) |
| POST | `/api/secrets` | Upsert secret `{ name, value }` — encrypts and stores |
| DELETE | `/api/secrets/:name` | Remove a secret |

### API authentication
All protected routes require `X-API-Key` header. Auth is implemented as a Fastify `preHandler` hook scoped to a protected plugin — not per-route. Comparison uses `timingSafeEqual`.

### Cookie consent (`browser/cookieConsent.ts`)
Strategies are tried in order with a 3s timeout each:
1. Cookiebot → OneTrust → TrustArc → generic text match (`/^(accept|akkoord|accepteer|agree|allow all|toestaan)/i`) → shadow DOM pierce → iframe-based banners

After clicking, always wait 500–1000ms before continuing — CMPs fire XHR after accept that re-renders the page.

### Database
Drizzle ORM with `postgres-js` (PostgreSQL 17). Migrations in `backend/db/migrations/` run automatically at startup via `drizzle-orm/postgres-js/migrator`. All queries go through `backend/db/queries/` helpers — never raw SQL in business logic.

### Logging
Always use pino child loggers (`logger.child({ runId, url })`). Never `console.log`. Log level via `LOG_LEVEL` env var. Output is JSON on stdout (Coolify captures it).

## Key invariants
- A single URL failure must not abort the group run — `visitor.ts` catches per-URL errors and returns them in `VisitResult.error`; `runner.ts` sets status `partial_failure` if some fail, `failed` if all fail
- `config.yaml` is live-reloadable — do not cache its contents outside `backend/config/urls.ts`
- Browserless is **not** included in `docker-compose.yml` — you must provide your own instance and set `BROWSERLESS_WS_URL`
