# W1 — Redact secrets from logs

**Wave:** A (independent)
**Model:** `claude-sonnet-4-6` — multi-file change with cross-cutting logging concerns; Haiku is too narrow, Opus is unnecessary.
**Findings:** F1 (High), F2 (High)
**Status:** done

## Goal

Stop emitting the Browserless token and the raw webhook token to log output. Both currently appear in the default error paths and reach whatever log aggregator (Coolify/stdout) is attached.

## Problem

1. `backend/services/lighthouseAudit.ts:52` builds
   `endpoint = ${base}/chromium/performance?token=${env.BROWSERLESS_TOKEN}&timeout=120000`
   and line 157 logs `{ endpoint, ... }` on audit failure.
2. `backend/api/server.ts:51-54` global error handler logs `{ url: _request.url }`. For errors raised inside `POST /webhook/trigger/:token`, `request.url` contains the token in the path.

## Changes

### `backend/services/lighthouseAudit.ts`
- Build the fetch target via `URL`/`URLSearchParams` — keep the token out of any stringified shape.
- Only log `{ url, base, path: '/chromium/performance' }` — never the full URL.
- Keep `url` (the target being audited) as-is; that is not a secret.

### `backend/api/server.ts`
- In `setErrorHandler`, sanitize `request.url` before logging:
  ```ts
  const safeUrl = request.url.replace(/(\/webhook\/trigger\/)[^/?#]+/, '$1[REDACTED]');
  logger.error({ err: error, url: safeUrl }, 'unhandled route error');
  ```

### `backend/utils/logger.ts` (optional, if bundle elsewhere grows)
- Not needed for this worker; don't add a redaction framework yet. Keep the edits local.

## Definition of Done

- Lighthouse audit failure log record contains neither `?token=` nor the raw token value.
- `POST /webhook/trigger/<tok>` failure log record shows `/webhook/trigger/[REDACTED]`.
- New vitest unit test in `backend/services/lighthouseAudit.test.ts` asserts the error log payload has no `BROWSERLESS_TOKEN`.
- New integration test in `backend/api/api.test.ts` forces an error on the webhook trigger route and asserts the captured log URL is redacted (use `pino`'s test transport, or a logger mock).
- `pnpm test && pnpm typecheck && pnpm lint` all pass.
