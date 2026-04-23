# PrimeCache — Security Remediation Plan (2026-04-23)

Source audit: full-project security review on branch `feature/run-screenshots`.
Findings list: see [findings.md](findings.md) (F1–F20).

## Model assignment policy

| Tier | Model | When to use |
|------|-------|-------------|
| **Architect** | `claude-opus-4-7` | Cross-cutting design: new auth/session model, DB schema migrations that touch multiple code paths, decisions with security tradeoffs. |
| **Implementer** | `claude-sonnet-4-6` | Focused multi-file edits with local reasoning: sanitizer helpers, logger redaction, route hardening, helmet config. Default choice. |
| **Mechanic** | `claude-haiku-4-5-20251001` | Single-file, low-ambiguity diffs: Dockerfile USER, input validators, rate-limit wiring, filename escaping, single-line redactions. |

Pick the lowest tier that fully covers the task. Don't route security-boundary design to Haiku; don't burn Opus on a one-line fix.

## Task bundling rules

- Group findings that touch the **same file** into one worker — prevents merge conflicts.
- Split findings that are **independent** into parallel workers — shortens wall clock.
- A task that needs a **DB migration** is its own worker (migrations are serialized by Drizzle).
- Auth rewrite (W5) blocks downstream work on the same files; schedule it before W1/W3.

## Execution waves

```
Wave A (parallel — no cross-dependencies)
  W1  Secret-leak redaction in logs            (Sonnet)   — lighthouseAudit.ts, server.ts, logger.ts
  W6  Security response headers (@fastify/helmet)         (Sonnet)   — server.ts
  W7  Dockerfile non-root user                 (Haiku)    — Dockerfile
  W10 Silent fire-and-forget error logging     (Haiku)    — routes/groups.ts, server.ts

Wave B (depends on W1; parallel within)
  W2  CSV export sanitizer (formula/quote/filename)       (Sonnet)   — routes/groups.ts
  W3  Error handler hardening + input validation          (Sonnet)   — server.ts
  W8  Login timing fix                          (Haiku)    — server.ts
  W9  DELETE /runs safety guard                 (Haiku)    — server.ts, queries/runs.ts
  W11 Cookie header sanitization                (Sonnet)   — lighthouseAudit.ts

Wave C (architectural — single worker owns auth)
  W5  Session auth + remove API_KEY from login  (Opus)     — server.ts, frontend/lib/api.ts, db/schema.ts, new session table

Wave D (depends on W5 landing; schema migration)
  W4  Hash webhook tokens at rest + header delivery       (Sonnet)   — queries/webhookTokens.ts, routes/webhooks.ts, db/schema.ts

Wave E (informational / defer)
  W-INFO  F13/F14/F15/F16/F17 notes and follow-ups        (n/a)      — documentation only
```

Wave A and Wave B can begin in parallel once W1 lands (W2/W3 touch the same file as W1, so order matters only within routes/groups.ts and server.ts).
Wave C (W5) is the big one — allocate dedicated human review; it changes the auth model.

## Worker index

| ID  | Title | Model | Findings | Severity |
|-----|-------|-------|----------|----------|
| [W1](tasks/W1-redact-secret-logs.md)  | Redact Browserless token + webhook token from logs | Sonnet | F1, F2 | High |
| [W2](tasks/W2-csv-sanitizer.md)  | CSV export sanitizer (formula/quote/filename)      | Sonnet | F5, F6, F7 | Medium |
| [W3](tasks/W3-error-handler.md)  | Error handler hardening + route input validation   | Sonnet | F3, F18 | Medium |
| [W4](tasks/W4-webhook-token-hashing.md)  | Webhook token hash-at-rest + move to header        | Sonnet | F4, F12 | Medium |
| [W5](tasks/W5-session-auth.md)  | Replace API_KEY-as-session with signed sessions    | Opus   | F8, F9   | Medium |
| [W6](tasks/W6-security-headers.md)  | Add `@fastify/helmet` with strict CSP              | Sonnet | F10      | Low |
| [W7](tasks/W7-dockerfile-non-root.md)  | Dockerfile: drop to non-root user                  | Haiku  | F11      | Low |
| [W8](tasks/W8-login-timing.md)  | Login timing side-channel fix                      | Haiku  | F13      | Info |
| [W9](tasks/W9-delete-runs-guard.md)  | Require confirm on unqualified DELETE /runs        | Haiku  | F20      | Info |
| [W10](tasks/W10-silent-errors.md) | Replace silent `catch {}` with error logs          | Haiku  | F19      | Info |
| [W11](tasks/W11-cookie-header.md) | Validate/encode cookies forwarded to Browserless   | Sonnet | F17      | Info |

Findings F14 (non-constant-time token lookup), F15 (SSRF via admin config — accepted risk), F16 (yaml.load — verified safe) are accepted as-is; tracked in [findings.md](findings.md) but have no worker.

## Done criteria for the plan

- All High + Medium findings have a landed PR.
- Each worker's task file lists its Definition of Done; the plan is done when every DoD is checked.
- A follow-up security pass re-runs the same audit rubric and finds none of F1–F12 still present.
