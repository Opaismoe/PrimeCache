# T03 — Dashboard: URLs Visited Per Day → Bar/Column Chart

**Wave:** 1 (parallel with T01, T02)
**Status:** todo

## Goal

Replace the line chart "URLs visited per day (last 30 days)" on the dashboard with a stacked or grouped vertical bar/column chart. Each bar represents one day; bars are split (or grouped) by group name, color-coded per group.

## Context

- Dashboard file: `frontend/src/routes/index.tsx`
- Chart library: Recharts
- Data source: `getStats()` → `/api/stats`
  - Returns `{ visitsPerDay: { date: string, group: string, count: number }[] }`
  - Dates are ISO strings (last 30 days), one row per group per day
- Data must be pivoted: `{ date, [groupName]: count }[]` for Recharts stacked BarChart

## Files to Modify

- `frontend/src/routes/index.tsx`
  - Remove `LineChart`, `Line` (or keep if used elsewhere in the file)
  - Add `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `Legend`, `CartesianGrid`, `ResponsiveContainer`
  - Pivot the `visitsPerDay` data into the format Recharts stacked BarChart expects
  - One `<Bar>` per group name, each a distinct color
  - X axis: formatted date (e.g. "Mar 15"), Y axis: count

## Data Pivot Logic

```typescript
// Input: { date: string, group: string, count: number }[]
// Output: { date: string, [group: string]: number }[]
const pivoted = visitsPerDay.reduce((acc, row) => {
  const entry = acc.find(e => e.date === row.date) ?? { date: row.date }
  entry[row.group] = row.count
  if (!acc.find(e => e.date === row.date)) acc.push(entry)
  return acc
}, [] as Record<string, number | string>[])
```

## Steps

1. Read `frontend/src/routes/index.tsx` — locate the line chart section
2. Identify all group names available in the stats data (derive from `visitsPerDay`)
3. Implement pivot logic
4. Replace `<LineChart>` JSX with `<BarChart>` using `stackId="a"` on each `<Bar>` for stacked display
5. Format date labels on X axis with `formatChartDate` (already in `frontend/src/lib/formatChartDate.ts`)
6. Run `pnpm typecheck` and `pnpm lint` — must pass

## Definition of Done

- Dashboard shows a stacked bar/column chart for URLs visited per day
- Each group has a distinct color, with a legend
- X axis shows date labels, tooltip shows per-group counts
- No TypeScript errors
- Commit: `feat(ui): replace URLs per day line chart with stacked bar chart`
