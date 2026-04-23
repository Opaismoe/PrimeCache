# T02 — Dashboard: Run Status Breakdown → Bar/Column Chart

**Wave:** 1 (parallel with T01, T03)
**Status:** todo

## Goal

Replace the pie chart on the dashboard that shows "Run status breakdown" with a vertical bar/column chart. Each bar represents one status category (Completed, Partial, Failed, Cancelled), colored consistently with the existing status badge colors.

## Context

- Dashboard file: `frontend/src/routes/index.tsx`
- Chart library already in use: Recharts (look for `PieChart`, `Pie`, `Cell` imports)
- Data source: `getStats()` → `/api/stats` — returns `{ statusBreakdown: { status: string, count: number }[] }`
- Existing color map for statuses is used in `StatusBadge.tsx` — reuse those colors

## Files to Modify

- `frontend/src/routes/index.tsx`
  - Remove `PieChart`, `Pie`, `Cell` (or keep if used elsewhere)
  - Add `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `CartesianGrid`, `ResponsiveContainer` from recharts
  - Replace the `<PieChart>` JSX block with a `<BarChart>` block
  - X axis: status labels (Completed, Partial Failure, Failed, Cancelled)
  - Y axis: count
  - Each bar gets the status color

## Status Color Reference

| Status | Color |
|--------|-------|
| completed | `#22c55e` (green-500) |
| partial_failure | `#f59e0b` (amber-500) |
| failed | `#ef4444` (red-500) |
| cancelled | `#6b7280` (gray-500) |

## Steps

1. Read `frontend/src/routes/index.tsx` — locate the pie chart section
2. Read `frontend/src/components/StatusBadge.tsx` — note color values
3. Replace the pie chart JSX with a `BarChart` from recharts
4. Format X axis labels to be human-readable (e.g. `partial_failure` → `Partial`)
5. Run `pnpm typecheck` and `pnpm lint` — must pass

## Definition of Done

- Dashboard shows a vertical bar/column chart for run status breakdown
- Bars are correctly colored by status
- Chart has axis labels and a tooltip showing count on hover
- No TypeScript errors
- Commit: `feat(ui): replace run status pie chart with bar chart`
