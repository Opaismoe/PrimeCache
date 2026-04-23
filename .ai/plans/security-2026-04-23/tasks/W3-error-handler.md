# W3 — Error handler hardening + route input validation

**Wave:** B (parallel; touches `server.ts` — avoid overlapping with W1/W5/W8/W9 by sequencing)
**Model:** `claude-sonnet-4-6` — small reasoning around which errors are client-safe vs internal.
**Findings:** F3 (Medium), F18 (Info)
**Status:** done

## Goal

Stop leaking internal exception messages (Postgres errors, stack-adjacent strings) in HTTP responses. Validate numeric route params so malformed input short-circuits with a 400 instead of surfacing a 500.

## Problem

1. `backend/api/server.ts:53` replies with `error.message` verbatim for every thrown error.
2. Several routes (`GET /runs/:id`, `GET /runs/:id/screenshots`, `POST /runs/:id/cancel`) call `Number(request.params.id)` without validation. `Number("abc") === NaN` produces a Drizzle/Postgres error, which the error handler then reflects (F3 compounds F18).

## Changes

### `backend/api/server.ts`

- Rework the global error handler:
  ```ts
  app.setErrorHandler((error, request, reply) => {
    const status = error.statusCode ?? 500;
    logger.error({ err: error, url: request.url, status }, 'unhandled route error');
    if (status >= 500) {
      return reply.code(status).send({ error: 'Internal Server Error' });
    }
    return reply.code(status).send({ error: error.message });
  });
  ```
  (URL redaction comes from W1 — do not duplicate it here; coordinate merge order.)
- Add a small helper:
  ```ts
  function parseId(raw: string): number | null {
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  ```
- Apply it to `/runs/:id`, `/runs/:id/screenshots`, `/runs/:id/cancel`, `/webhooks/:id` (DELETE/PATCH). Return `reply.code(400).send({ error: 'Invalid id' })` on null.

## Definition of Done

- `GET /api/runs/abc` returns 400 with `{ error: 'Invalid id' }`, not 500.
- A forced internal exception (e.g. in a test, mock `getRunById` to throw) yields response body `{ error: 'Internal Server Error' }` and a full server-side log entry.
- Vitest coverage added to `backend/api/api.test.ts` for both cases.
- `pnpm test && pnpm typecheck && pnpm lint` all pass.

## Coordination

- Merge after W1 to keep the error-handler edit conflict-free, or rebase.
- W5 also rewrites login failure paths — keep the "5xx → generic" rule intact there.
