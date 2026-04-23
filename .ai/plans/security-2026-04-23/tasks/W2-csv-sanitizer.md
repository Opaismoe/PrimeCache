# W2 — CSV export sanitizer

**Wave:** B (must land after W1 if sequenced; otherwise independent)
**Model:** `claude-sonnet-4-6` — single file but requires careful handling of three separate concerns (formula injection, quote doubling, header filename).
**Findings:** F5 (Medium), F6 (Low), F7 (Low)
**Status:** done

## Goal

Neutralize attacker-controlled content scraped from monitored websites before it reaches the CSV export. Harden the `Content-Disposition` filename for group names that contain special characters.

## Problem

`backend/api/routes/groups.ts:129-201` emits CSV cells as `"${value}"` with no escaping. Fields sourced from third-party sites (SEO title, meta description, h1, canonical URL, broken-link URL, broken-link error) can contain `=`/`+`/`-`/`@` to trigger Excel formula evaluation, or embedded `"` to corrupt parsing and break out of the quoted cell. The filename in `Content-Disposition` interpolates the raw group name.

## Changes

### `backend/api/routes/groups.ts`

1. Add a top-level helper:
   ```ts
   function csvCell(v: unknown): string {
     if (v == null) return '""';
     const s = String(v);
     const escaped = s.replace(/"/g, '""');
     const needsGuard = /^[=+\-@\t\r]/.test(s);
     return `"${needsGuard ? `'${escaped}` : escaped}"`;
   }
   ```
2. Replace every `"${...}"` interpolation in the four `tab` branches with `csvCell(...)`. Keep numeric cells as plain numbers (don't quote them — or do, consistently; pick one — prefer quoting everything via `csvCell` for simplicity).
3. Sanitize the filename:
   ```ts
   const safeName = name.replace(/[^\w.-]/g, '_');
   const filename = `${safeName}-${tab}.csv`;
   reply
     .header('Content-Type', 'text/csv; charset=utf-8')
     .header(
       'Content-Disposition',
       `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(`${name}-${tab}.csv`)}`,
     )
     .send(csv);
   ```

## Definition of Done

- New `backend/api/routes/groups.csv.test.ts` covering:
  - A cell starting with `=`, `+`, `-`, `@` gets `'`-prefixed.
  - A cell containing `"` is doubled.
  - A null/undefined cell is `""`.
  - Group name `evil";filename="x.html` does not break out of the filename quote.
- Export a real run and open in LibreOffice Calc; formulas do not auto-evaluate.
- `pnpm test && pnpm typecheck && pnpm lint` all pass.
