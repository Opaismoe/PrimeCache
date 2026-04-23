# Findings Register — 2026-04-23

One-line summary of each finding from the full-project audit. Detailed write-ups (description, PoC, fix) live in the corresponding worker task file under `tasks/`.

| ID  | Severity | Confidence | File | Summary | Worker |
|-----|----------|------------|------|---------|--------|
| F1  | High     | High   | `backend/services/lighthouseAudit.ts:52,157` | Browserless token logged in `endpoint` on audit failure | W1 |
| F2  | High     | High   | `backend/api/server.ts:51-54` | Error handler logs `request.url` including webhook token | W1 |
| F3  | Medium   | High   | `backend/api/server.ts:53` | `error.message` echoed to HTTP response (DB internals leak) | W3 |
| F4  | Medium   | High   | `backend/db/queries/webhookTokens.ts:24-64` | Webhook tokens stored plaintext in DB | W4 |
| F5  | Medium   | High   | `backend/api/routes/groups.ts:129-201` | CSV injection — scraped fields unescaped | W2 |
| F6  | Low      | High   | `backend/api/routes/groups.ts:166-195` | CSV quote-doubling missing → malformed CSV | W2 |
| F7  | Low      | Medium | `backend/api/routes/groups.ts:136,199` | Content-Disposition filename not escaped | W2 |
| F8  | Medium   | High   | `backend/api/server.ts:63-85` | Login returns `env.API_KEY`; no sessions/expiry/revocation | W5 |
| F9  | Low      | High   | `frontend/src/lib/api.ts:22-30` | API key stored in `localStorage` | W5 |
| F10 | Low      | High   | `backend/api/server.ts` | No security headers (CSP/HSTS/XCTO/Referrer-Policy) | W6 |
| F11 | Low      | High   | `Dockerfile:21-36` | Image runs as root (no USER directive) | W7 |
| F12 | Low      | High   | `backend/api/routes/webhooks.ts:88-123` | Webhook token in URL path → leaks to proxy/access logs | W4 |
| F13 | Info     | Low    | `backend/api/server.ts:69-82` | `timingSafeEqual` length-mismatch throws → weak username-length oracle | W8 |
| F14 | Info     | Low    | `backend/db/queries/webhookTokens.ts:57-64` | Non-constant-time DB `=` (moot after F4) | — |
| F15 | Info     | Medium | `backend/warmer/visitor.ts:347-363,473-492`; `routes/groups.ts:71-108` | SSRF only reachable via trusted config/admin input | — |
| F16 | Info     | High   | `backend/config/urls.ts:70` | `yaml.load` safe in js-yaml 4.x; verify pin stays `^4` | — |
| F17 | Info     | Medium | `backend/services/lighthouseAudit.ts:60-67` | Cookie header built without value validation | W11 |
| F18 | Info     | High   | `backend/api/server.ts:119-193` | `Number(id)` → NaN reaches DB, surfaces as 500 | W3 |
| F19 | Info     | Medium | `backend/api/routes/groups.ts:96-105` | Silent `catch {}` swallows lighthouse errors | W10 |
| F20 | Info     | High   | `backend/api/server.ts:196-200` | Unqualified `DELETE /runs` wipes all history | W9 |

See `README.md` for the execution plan and model assignments.
