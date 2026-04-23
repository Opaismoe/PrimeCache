# W10 — Replace silent `catch {}` with error logs

**Wave:** A (independent)
**Model:** `claude-haiku-4-5-20251001` — purely mechanical edits.
**Findings:** F19 (Info)
**Status:** done

## Goal

Stop swallowing fire-and-forget errors. A persistent lighthouse failure or warm-run inner persistence error currently produces no operator-visible signal.

## Problem

Silent `catch {}` / `.catch(() => {})` blocks at:
- `backend/api/routes/groups.ts:101-103` — lighthouse trigger IIFE drops errors entirely.
- `backend/warmer/runner.ts:101-131` — per-sub-insert `.catch(() => {})` drops errors for seo/headers/cwv/screenshot/brokenLinks/accessibility/crawled-url persistence. Keeping the run alive is correct; dropping the log line is not.

## Changes

- Replace `.catch(() => {})` with `.catch((err) => logger.warn({ err, ... }, '<what failed>'))`.
- Add `logger` + runId/visitId context to each log call so the entry is actionable.
- In the lighthouse IIFE in `routes/groups.ts`, add `.catch((err) => logger.warn({ err, url, name }, 'manual lighthouse audit failed'))`.

## Definition of Done

- No `catch {}` or `.catch(() => {})` remain in backend source (excluding test files and any truly intentional best-effort cleanups in shutdown paths — document those with a comment).
- A forced insert failure in tests still lets the run complete, but produces a warn log.
- `pnpm test && pnpm typecheck && pnpm lint` all pass.
