# W8 — Login timing side-channel fix

**Wave:** B (touches `server.ts`)
**Model:** `claude-haiku-4-5-20251001` — small, well-scoped change.
**Findings:** F13 (Info)
**Status:** done

## Goal

Make the login comparison immune to length-based timing inference of `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

## Problem

`backend/api/server.ts:69-82` passes raw buffers of different lengths to `timingSafeEqual`, which throws, which the catch handler short-circuits. The throw-then-catch path has a slightly different wall-clock cost than the equal-length compare path. Not practically exploitable over the network, but trivial to fix.

## Changes

### `backend/api/server.ts`

Replace the login body with a SHA-256-based compare. Both inputs become fixed 32-byte buffers so `timingSafeEqual` never throws on length mismatch:

```ts
import { createHash, timingSafeEqual } from 'node:crypto';

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

// inside /auth/login:
const userOk = safeEqual(username, env.ADMIN_USERNAME);
const passOk = safeEqual(password, env.ADMIN_PASSWORD);
if (!(userOk && passOk)) return reply.code(401).send({ error: 'Unauthorized' });
```

- Apply the same pattern to `requireApiKey` (or `requireAuth` if W5 landed first).

## Definition of Done

- Login tests still pass (`backend/api/api.test.ts` login block).
- No `try`/`catch` needed around the compare.
- `pnpm test && pnpm typecheck && pnpm lint` all pass.

## Coordination

- If W5 lands first, apply the same pattern there; if this lands first, W5 picks up the helper.
