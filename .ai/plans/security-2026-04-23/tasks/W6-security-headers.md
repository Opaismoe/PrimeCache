# W6 — Security response headers

**Wave:** A (independent)
**Model:** `claude-sonnet-4-6` — CSP shape needs thought; wrong directives will break the SPA (screenshots use `data:` image URIs, charts inject inline styles).
**Findings:** F10 (Low)
**Status:** done

## Goal

Register `@fastify/helmet` with a strict-but-working CSP and the standard set of hardening headers.

## Problem

No CSP, no HSTS, no `X-Content-Type-Options`, no `Referrer-Policy`, no `X-Frame-Options` are emitted. A future XSS has no defense-in-depth; the SPA origin is framable; referrer headers leak full URLs cross-origin.

## Changes

### `backend/package.json`

- Add `@fastify/helmet`.

### `backend/api/server.ts`

```ts
import helmet from '@fastify/helmet';

await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // tailwind inline styles; tighten later with nonces
      imgSrc: ["'self'", 'data:'],              // screenshots are inline data: JPEGs
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
```

- Place the registration **before** the static-file handler so headers apply to the SPA shell.

## Definition of Done

- `curl -I https://<host>/` shows CSP, HSTS, XCTO, Referrer-Policy, X-Frame-Options (via frame-ancestors).
- Screenshots still render in the run detail view (img-src includes `data:`).
- All existing vitest suites pass — helmet is a no-op during tests that use `app.inject`.
- No regressions in the admin / groups / status pages (smoke-test in a browser).
- `pnpm test && pnpm typecheck && pnpm lint` all pass.
