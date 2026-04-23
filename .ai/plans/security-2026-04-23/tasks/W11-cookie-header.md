# W11 — Validate/encode cookies forwarded to Browserless

**Wave:** B (independent of others; touches `lighthouseAudit.ts` which W1 also edits — sequence after W1)
**Model:** `claude-sonnet-4-6` — reasoning about which cookies are safe to forward and cookie-header quoting.
**Findings:** F17 (Info)
**Status:** done

## Goal

Prevent malformed or injected cookie values (from arbitrary scraped sites) from corrupting the forwarded `Cookie` header, and drop cookies that have no reason to be forwarded (reduces blast radius if Browserless logs request headers).

## Problem

`backend/services/lighthouseAudit.ts:60-62` builds a `Cookie:` header by joining `${c.name}=${c.value}` with `; `. A cookie value containing `;`, `\r`, or `\n` either corrupts the header (likely rejected by Node's fetch — good) or smuggles an additional cookie. There is also no filtering — auth cookies captured during the warm visit get relayed to Browserless, which may persist request headers in its own logs.

## Changes

### `backend/services/lighthouseAudit.ts`

```ts
const FORBIDDEN = /[;\r\n]/;

function safeCookieHeader(
  cookies: Array<{ name: string; value: string }>,
): string | undefined {
  const parts = cookies
    .filter((c) => !FORBIDDEN.test(c.name) && !FORBIDDEN.test(c.value))
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`);
  return parts.length ? parts.join('; ') : undefined;
}
```

- Replace the inline `.map(...).join('; ')` with the helper.
- Document in a comment that only cookies relevant to CF clearance / auth-free content should be forwarded; consider a future allowlist (cf_clearance, __cf_bm).

### Tests

- Unit-test `safeCookieHeader`: drops names/values containing `;\r\n`, URL-encodes values with `=`.

## Definition of Done

- A cookie `{ name: 'x', value: 'a; Set-Cookie: evil=1' }` is either dropped or safely encoded such that the resulting header has only one cookie definition.
- Existing Lighthouse flow still works (the encoded value is decoded by Chromium/Browserless on receipt).
- `pnpm test && pnpm typecheck && pnpm lint` all pass.

## Coordination

- Merge after W1 (both edit `lighthouseAudit.ts`).
