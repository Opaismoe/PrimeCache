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
- Test files live alongside source: `src/config/env.test.ts` next to `src/config/env.ts`.
- Use in-memory SQLite (`:memory:`) for DB tests — never mock the query layer itself.
- Mock only external I/O: Browserless WS, filesystem. Never mock the module under test.
- After completing a task, update its status in `.ai/todo.md`.

## Commands

```bash
pnpm dev           # run with ts-node-dev (watch mode)
pnpm build         # tsc → dist/
pnpm start         # node dist/index.js (production)
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint src/
pnpm test          # vitest run (single pass)
pnpm test:watch    # vitest (watch mode)
```

Run a single test file:
```bash
pnpm test src/warmer/runner.test.ts
```

Docker:
```bash
docker-compose up          # local dev (includes local Browserless)
docker-compose up --build  # rebuild image
```

## Environment variables

Required (no defaults):
- `BROWSERLESS_WS_URL` — e.g. `ws://localhost:3000/chromium/playwright`
- `BROWSERLESS_TOKEN` — any non-empty string for local Browserless
- `API_KEY` — minimum 16 characters

Optional (defaults shown):
- `DB_PATH=/app/data/warmer.db`
- `CONFIG_PATH=/app/config/config.yaml`
- `PORT=3000`
- `LOG_LEVEL=info` (trace|debug|info|warn|error)
- `TIMEZONE=Europe/Amsterdam`
- `BETWEEN_URLS_MIN_MS=2000` / `BETWEEN_URLS_MAX_MS=5000`

## Architecture

`src/index.ts` boots in three sequential steps: run Knex migrations → start Fastify API → register node-cron schedulers. All three depend on the config and DB layers being ready first.

### Data flow for a warm run
1. **Trigger**: either node-cron (scheduled) or `POST /webhook/warm` (on-demand)
2. `scheduler/index.ts` or `api/routes/webhook.ts` calls `warmer/runner.ts`
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
- `src/config/env.ts` — Zod-parses `process.env` at startup. Hard exit if any required var is missing.
- `src/config/urls.ts` — Parses and Zod-validates `config.yaml`. Uses chokidar to watch for file changes and hot-reloads the scheduler without restarting the process.

`config.yaml` group options:
```yaml
options:
  scrollToBottom: true        # scroll to page bottom after load
  waitForSelector: "main"     # wait for CSS selector before measuring
  crawl: true                 # BFS crawl — discover and visit internal links
  crawl_depth: 2              # required when crawl: true; max 10
  userAgent: "MyBot/1.0"      # override the rotating user agent for this group
```

### API routes

All routes except `GET /health` require `X-API-Key` header.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check — no auth |
| GET | `/runs` | Paginated run history (`?limit=20&offset=0`) |
| GET | `/runs/latest` | Latest run per group |
| GET | `/runs/:id` | Run detail with visits |
| POST | `/trigger` | **Synchronous** — runs group, returns `{ runId }` when done |
| POST | `/webhook/warm` | **Async** — fires runs and responds immediately; `group: "all"` runs every group |
| GET | `/config` | Current loaded config |
| GET | `/api/groups/:name/overview` | Group overview — includes CWV data with `urlTrend: UrlCwvTrendPoint[]` (LCP/CLS/TTFB per URL per run) |
| GET | `/api/groups/:name/performance` | Group performance metrics |
| GET | `/api/groups/:name/uptime` | Group uptime metrics |

`POST /trigger` and `POST /webhook/warm` both take `{ "group": "<name>" }` as JSON body.

### API authentication
All routes except `GET /health` require `X-API-Key` header. Auth is implemented as a Fastify `preHandler` hook scoped to a protected plugin — not per-route. Comparison uses `timingSafeEqual`.

### Cookie consent (`browser/cookieConsent.ts`)
Strategies are tried in order with a 3s timeout each:
1. Cookiebot → OneTrust → TrustArc → generic text match (`/^(accept|akkoord|accepteer|agree|allow all|toestaan)/i`) → shadow DOM pierce → iframe-based banners

After clicking, always wait 500–1000ms before continuing — CMPs fire XHR after accept that re-renders the page.

### Database
Knex with `better-sqlite3`. Migrations run automatically at startup. All queries go through `src/db/queries/` helpers — never raw Knex calls in business logic. SQLite file is volume-mounted at `DB_PATH`.

### Logging
Always use pino child loggers (`logger.child({ runId, url })`). Never `console.log`. Log level via `LOG_LEVEL` env var. Output is JSON on stdout (Coolify captures it).

## Key invariants
- A single URL failure must not abort the group run — `visitor.ts` catches per-URL errors and returns them in `VisitResult.error`; `runner.ts` sets status `partial_failure` if some fail, `failed` if all fail
- `config.yaml` is live-reloadable — do not cache its contents outside `config/urls.ts`
- The `data/` and `logs/` directories are Docker volumes — never write SQLite or log files relative to `__dirname`
