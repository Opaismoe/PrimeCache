# T13 — Run Detail Redesign

**Wave:** 3 (parallel with T14-T16; depends on T08)
**Status:** todo

## Goal

Redesign the run detail page (`/history/$runId`) with a more polished layout: header with status badges + chips, 5 KPI tiles, a waterfall visualization using per-visit timing, and improved visit table.

## Design

```
← History / {group} / Run #1018

● completed  cron  21-04 11:00  54s
Run #1018
Warmed 48 URLs across think.ing.com. All 200s.

[ URLs: 48 ] [ Success: 100% ] [ Avg load: 497ms ] [ Avg TTFB: 215ms ] [ Failed: 0 ]

Request waterfall — blue = TTFB · orange = content
URL              STATUS  LOAD  TTFB  [▓▓▓░░░░░░░░░] bar
/                200     707ms  215ms ████░░░░
/economy/        200     271ms  110ms ██░░
...

Visit table (sortable)
```

## Available Data

From `RunDetail.visits: Visit[]`:
- `url`, `status_code`, `ttfb_ms`, `load_time_ms`, `error`, `visited_at`, `final_url`

**Waterfall**: Use `load_time_ms` as total bar width (relative to max), `ttfb_ms` as the TTFB segment. No start offsets (sequential visits, data not stored).

**5 KPI tiles**: URLs (total_urls), Success % (success_count / total_urls × 100), Avg load (avg of load_time_ms), Avg TTFB (avg of ttfb_ms), Failed (failure_count).

## Files to Modify

- `frontend/src/routes/history_.$runId.tsx` — full redesign of the page

## Definition of Done

- Header shows run # with status badge, trigger type chip, time, duration
- 5 KPI tiles render
- Waterfall shows TTFB + content segments as horizontal bars, sorted by load time desc
- Visit table still present below waterfall
- No TypeScript errors
