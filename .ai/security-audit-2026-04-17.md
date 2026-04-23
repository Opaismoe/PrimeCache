# PrimeCache — Security & Code Review (2026-04-17)

Scope: backend auth, crypto, route handlers, config loader, warmer, Docker wiring.

## Critical

1. **`/api/auth/login` returns the master `API_KEY`** (`backend/api/server.ts:82`). Every dashboard login hands the user the exact same shared secret machine clients use.
   - No per-user tokens, no revocation, no expiry.
   - `localStorage` in the SPA (`frontend/src/lib/api.ts:28`) means XSS permanently exfiltrates the server-wide credential; rotation requires an env-var redeploy.
   - **Fix:** issue short-lived signed JWTs tied to a session row; keep `API_KEY` for M2M only; httpOnly+Secure+SameSite cookie, or in-memory with rotation.

2. **Browserless token leaks to logs** (`backend/services/lighthouseAudit.ts:157`). Error branch logs `{ endpoint, error }` where `endpoint` embeds `?token=<BROWSERLESS_TOKEN>`.
   - **Fix:** log `base` only; pass token via header; add a redaction helper in `utils/logger.ts`.

3. **Postgres published on host** (`docker-compose.yml:38`). `5432:5432` exposes DB if host has a public interface.
   - **Fix:** delete `ports:` block; use `expose: ["5432"]`.

4. **No brute-force protection on `/api/auth/login`**. `ADMIN_PASSWORD` minimum is 8.
   - **Fix:** `@fastify/rate-limit` (e.g. 5/min/IP); raise minimum to 12.

## High

5. **`timingSafeEqual` throws on unequal length** (`server.ts:69-95`). Length-mismatch path diverges in timing from compare path, leaking key length.
   - **Fix:** sha256 both sides and compare fixed-length digests.

6. **SSRF via `checkBrokenLinks` and Lighthouse trigger** (`visitor.ts:478`, `routes/groups.ts:72-108`). No validation of target host — RFC1918 / link-local / loopback reachable from the server.
   - **Fix:** DNS-resolve, reject private/loopback/link-local; deny non-http(s); apply to warm fetcher and Lighthouse.

7. **CSV injection in `/groups/:name/export`** (`routes/groups.ts:138-195`). Untrusted SEO/link fields not neutralized for `= + - @ \t \r`.
   - **Fix:** prefix `'` when leading char is dangerous; double embedded quotes.

8. **`yaml.load` without explicit schema** (`config/urls.ts:70`). Confirm js-yaml v4 and pin `{ schema: yaml.JSON_SCHEMA }`. Treat config as hostile: `PUT /api/config` writes back via `yaml.dump`.

9. **Webhook token in URL path** (`/webhook/trigger/:token`). Leaks to access logs, Referer, browser history.
   - **Fix:** move to `Authorization: Bearer` or `X-Webhook-Token` header.

10. **No security headers**. No `@fastify/helmet`; no CSP, HSTS, XCTO, X-Frame-Options, Referrer-Policy. SPA renders third-party data (SEO titles, a11y HTML snippets) — unescaped render = stored XSS.
    - **Fix:** register `@fastify/helmet` with strict CSP; audit frontend for `dangerouslySetInnerHTML`.

## Medium

11. **Error handler echoes `error.message`** (`server.ts:52`). Leaks zod/Drizzle internals.
    - **Fix:** generic message in production, full only in dev.

12. **A11y `violations` stored as raw HTML** (`schema.ts:98`). XSS risk if ever rendered as HTML. Sanitize on write or render as text.

13. **Screenshots stored as base64 `text`** (`schema.ts:76`). No retention/size cap — DB bloat / OOM vector.
    - **Fix:** `bytea`, size guard, retention job.

14. **`cancelRun` races with the worker** (`server.ts:169` vs `runner.ts:139-152`). Stale counts; two finalization paths.
    - **Fix:** single finalize path; cancel only flips the signal and lets the runner finalize.

15. **`PUT /api/config` non-atomic write** (`routes/config.ts:36`). Partial file → chokidar reload fails.
    - **Fix:** `writeFileSync(tmp)` + `renameSync(tmp, path)`.

16. **Group rename is non-transactional** (`routes/config.ts:31`). Partial failure orphans webhook tokens.
    - **Fix:** wrap in a DB transaction.

17. **`decodeURIComponent(request.params.name)`** in every group route. Fastify already decodes — double-decoding turns `%2525` → `%`.
    - **Fix:** remove explicit decode.

18. **No body validation on `POST /api/trigger{,/async}` / `/webhook/warm`**. TS annotations only.
    - **Fix:** zod validate, matching `PUT /config`.

19. **Post-run Lighthouse loop ignores cancellation** (`runner.ts:156-173`). Fire-and-forget IIFE runs after `signal.aborted` / timeout.
    - **Fix:** gate each iteration on `signal.aborted`.

20. **Dockerfile runs as root** (`Dockerfile`). Add `USER node`, `chown` the app dir.

## Low / quality

21. Verify `.env` never entered git history: `git log --all --full-history -- .env`.
22. `console.error` in `config/urls.ts:88` violates CLAUDE.md ("Never `console.log`"). Use `logger`.
23. `/webhook/warm` returns `runIds: [-1, -1]` placeholders — dead data; either resolve real IDs via `startRunGroup` or omit.
24. `lighthouseAudit.ts:52` URL join: trailing `/` in `BROWSERLESS_HTTP_URL` yields `//chromium/…`. Normalize.
25. `getLatestPerGroup` subquery readable but brittle; consider correlated join.

## Mitigation plan (execution order)

1. **Rotate `BROWSERLESS_TOKEN`** (leaked to logs). Redact in logger. Scrub existing logs.
2. **Remove Postgres host port binding**; rotate `POSTGRES_PASSWORD`.
3. **Replace login flow**: session JWTs + DB sessions; move storage out of localStorage.
4. **Add `@fastify/rate-limit`** on `/api/auth/login` and `/webhook/trigger/:token`. Add **`@fastify/helmet`** globally.
5. **Harden constant-time compare**: sha256 then `timingSafeEqual`, same for admin creds.
6. **URL validation** for `checkBrokenLinks` + Lighthouse trigger (private-range deny list + DNS guard).
7. **CSV sanitizer**; text-only rendering of a11y HTML.
8. **Atomic `PUT /config` write**; DB transaction around group rename.
9. **Zod-validate mutating route bodies**; drop redundant `decodeURIComponent`.
10. **Screenshot retention/size caps**; gate post-run Lighthouse on abort signal.
11. **Run container non-root**; pin js-yaml schema.

Follow `CLAUDE.md` TDD states (init → test → code → review → done) for each item; branch per fix.
