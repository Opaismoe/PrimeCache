# T09 — JetBrains Mono Font + Design Tokens

**Wave:** 1 (parallel with T08)
**Status:** todo

## Goal

Add JetBrains Mono as the monospace font for data values, URLs, and metrics. Update accent color to amber/ember to match the "cache-warming = warm color" brand direction.

## Files to Modify

- `frontend/src/index.css` — add `@fontsource-variable/jetbrains-mono` import, add `--font-mono` token, tweak chart colors
- `frontend/package.json` — add `@fontsource-variable/jetbrains-mono` dependency

## Changes

### font-mono

Add to `@theme inline`:
```css
--font-mono: "JetBrains Mono Variable", "Geist Mono", monospace;
```

### Usage

Apply `font-mono` to: metric values, URL text, run IDs, timestamps, code snippets.

## Definition of Done

- JetBrains Mono loads for monospace elements
- No TypeScript errors
- `pnpm typecheck` passes
