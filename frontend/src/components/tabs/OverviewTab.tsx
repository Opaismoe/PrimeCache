import { useNavigate } from '@tanstack/react-router';
import { createColumnHelper } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { formatDate, formatDuration, formatMs } from '@/lib/formatters';
import type {
  GroupOverview,
  GroupPerformance,
  GroupUptime,
  Run,
  UrlPerformance,
  UrlUptime,
} from '@/lib/types';
import { ExternalLink } from '../ExternalLink';
import { RunResults } from '../RunResults';
import { Sparkline } from '../Sparkline';
import { StatusBadge } from '../StatusBadge';

// ── Stat tile ─────────────────────────────────────────────────────────────────

function Tile({
  label,
  value,
  delta,
  higherIsBetter = true,
}: {
  label: string;
  value: string;
  delta?: number | null;
  higherIsBetter?: boolean;
}) {
  const arrow =
    delta == null || Math.abs(delta) < 0.05
      ? null
      : delta > 0
        ? higherIsBetter
          ? { icon: '↑', cls: 'text-green-500' }
          : { icon: '↑', cls: 'text-destructive' }
        : higherIsBetter
          ? { icon: '↓', cls: 'text-destructive' }
          : { icon: '↓', cls: 'text-green-500' };

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-xl font-semibold tabular-nums">{value}</span>
        {arrow && <span className={`text-xs font-medium ${arrow.cls}`}>{arrow.icon}</span>}
      </div>
    </div>
  );
}

// ── Column definitions ────────────────────────────────────────────────────────

const perfColumnHelper = createColumnHelper<UrlPerformance>();

function makePerfColumns(trendByUrl: Map<string, number[]>) {
  return [
    perfColumnHelper.accessor('url', {
      header: 'URL',
      cell: (info) => (
        <div className="flex min-w-0 max-w-xs items-center gap-2">
          {info.row.original.isSlow && (
            <Badge variant="destructive" className="shrink-0 text-xs">
              Slow
            </Badge>
          )}
          <ExternalLink href={info.getValue()} className="truncate font-mono text-xs">
            {info.getValue()}
          </ExternalLink>
        </div>
      ),
    }),
    perfColumnHelper.accessor('p50LoadTimeMs', {
      header: 'P50 Load',
      cell: (info) => formatMs(info.getValue()),
    }),
    perfColumnHelper.accessor('p95LoadTimeMs', {
      header: 'P95 Load',
      cell: (info) => (
        <span className={info.row.original.isSlow ? 'font-medium text-destructive' : ''}>
          {formatMs(info.getValue())}
        </span>
      ),
    }),
    perfColumnHelper.accessor('p50TtfbMs', {
      header: 'P50 TTFB',
      cell: (info) => (info.getValue() != null ? formatMs(info.getValue()) : '—'),
    }),
    perfColumnHelper.accessor('p95TtfbMs', {
      header: 'P95 TTFB',
      cell: (info) => (info.getValue() != null ? formatMs(info.getValue()) : '—'),
    }),
    perfColumnHelper.accessor('sampleCount', {
      header: 'Samples',
      cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
    }),
    perfColumnHelper.display({
      id: 'trend',
      header: 'Trend',
      cell: (info) => {
        const trend = trendByUrl.get(info.row.original.url);
        if (!trend || trend.length < 2) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="w-20">
            <Sparkline data={trend} height={28} strokeWidth={1.5} />
          </div>
        );
      },
    }),
  ];
}

const uptimeColumnHelper = createColumnHelper<UrlUptime>();
const uptimeColumns = [
  uptimeColumnHelper.accessor('url', {
    header: 'URL',
    cell: (info) => (
      <ExternalLink href={info.getValue()} className="truncate font-mono text-xs">
        {info.getValue()}
      </ExternalLink>
    ),
  }),
  uptimeColumnHelper.accessor('uptimePct', {
    header: 'Uptime',
    cell: (info) => {
      const pct = info.getValue();
      return (
        <span
          className={
            pct >= 99
              ? 'font-medium text-green-500'
              : pct >= 95
                ? 'font-medium text-yellow-500'
                : 'font-medium text-destructive'
          }
        >
          {pct.toFixed(1)}%
        </span>
      );
    },
  }),
  uptimeColumnHelper.accessor('downCount', {
    header: 'Down',
    cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
  }),
  uptimeColumnHelper.accessor('totalChecks', {
    header: 'Checks',
    cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
  }),
  uptimeColumnHelper.accessor('lastStatus', {
    header: 'Last status',
    cell: (info) => (
      <Badge variant={info.getValue() === 'up' ? 'default' : 'destructive'} className="text-xs">
        {info.getValue() === 'up' ? 'Up' : 'Down'}
      </Badge>
    ),
  }),
  uptimeColumnHelper.accessor('lastCheckedAt', {
    header: 'Last checked',
    cell: (info) => (
      <span className="text-xs text-muted-foreground">{formatDate(info.getValue())}</span>
    ),
  }),
];

const runColumnHelper = createColumnHelper<Run>();
const runColumns = [
  runColumnHelper.accessor('id', {
    header: 'Run ID',
    cell: (info) => <span className="text-muted-foreground">#{info.getValue()}</span>,
  }),
  runColumnHelper.accessor('started_at', {
    header: 'Started',
    cell: (info) => formatDate(info.getValue()),
  }),
  runColumnHelper.display({
    id: 'duration',
    header: 'Duration',
    enableSorting: false,
    cell: (info) => formatDuration(info.row.original.started_at, info.row.original.ended_at),
  }),
  runColumnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  runColumnHelper.display({
    id: 'results',
    header: 'Results',
    enableSorting: false,
    cell: (info) => (
      <RunResults
        successCount={info.row.original.success_count}
        failureCount={info.row.original.failure_count}
      />
    ),
  }),
];

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  overview: GroupOverview | undefined;
  performance: GroupPerformance | undefined;
  uptime: GroupUptime | undefined;
}

export function OverviewTab({ overview, performance, uptime }: Props) {
  const navigate = useNavigate();

  if (!overview) return null;

  const { recentRuns, series } = overview;

  const latest = series.length > 0 ? series[series.length - 1] : null;
  const previous = series.length > 1 ? series[series.length - 2] : null;
  const hasSeoTile = latest?.avgSeoScore != null;

  const slowCount = performance ? performance.urls.filter((u) => u.isSlow).length : 0;
  const downCount = uptime ? uptime.urls.filter((u) => u.lastStatus === 'down').length : 0;

  // Build per-URL trend data for sparklines
  const trendByUrl = new Map<string, number[]>();
  if (performance) {
    const grouped = new Map<string, { startedAt: string; avgLoadTimeMs: number }[]>();
    for (const p of performance.loadTimeTrend) {
      if (!grouped.has(p.url)) grouped.set(p.url, []);
      grouped.get(p.url)?.push({ startedAt: p.startedAt, avgLoadTimeMs: p.avgLoadTimeMs });
    }
    for (const [url, points] of grouped) {
      trendByUrl.set(
        url,
        points.sort((a, b) => a.startedAt.localeCompare(b.startedAt)).map((p) => p.avgLoadTimeMs),
      );
    }
  }

  const perfColumns = makePerfColumns(trendByUrl);

  return (
    <div className="space-y-6">
      {/* ── Stat tiles ──────────────────────────────────────────────── */}
      {latest && (
        <div
          className={`grid gap-3 ${hasSeoTile ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}
        >
          <Tile
            label="Last run success"
            value={`${latest.successRate.toFixed(1)}%`}
            delta={previous ? latest.successRate - previous.successRate : null}
          />
          <Tile
            label="Last run load time"
            value={formatMs(latest.avgLoadTimeMs)}
            delta={previous ? latest.avgLoadTimeMs - previous.avgLoadTimeMs : null}
            higherIsBetter={false}
          />
          <Tile
            label="30-day uptime"
            value={
              uptime && uptime.urls.length > 0
                ? `${(uptime.urls.reduce((sum, u) => sum + u.uptimePct, 0) / uptime.urls.length).toFixed(1)}%`
                : '—'
            }
          />
          {hasSeoTile && (
            <Tile
              label="Last run SEO"
              value={String((latest.avgSeoScore as number).toFixed(1))}
              delta={
                previous?.avgSeoScore != null && latest.avgSeoScore != null
                  ? latest.avgSeoScore - previous.avgSeoScore
                  : null
              }
            />
          )}
        </div>
      )}

      {/* ── Performance ──────────────────────────────────────────────── */}
      {performance && performance.urls.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Performance</h3>

          {slowCount > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <span className="font-medium">
                {slowCount} slow {slowCount === 1 ? 'page' : 'pages'}
              </span>
              <span className="text-muted-foreground">— P95 load time exceeds 3s</span>
            </div>
          )}

          <DataTable
            columns={perfColumns}
            data={performance.urls}
            searchPlaceholder="Search URLs…"
            defaultSorting={[{ id: 'p95LoadTimeMs', desc: true }]}
          />
        </div>
      )}

      {/* ── Uptime ───────────────────────────────────────────────────── */}
      {uptime && uptime.urls.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Uptime</h3>

          {downCount > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <span className="font-medium">
                {downCount} {downCount === 1 ? 'URL' : 'URLs'} currently down
              </span>
            </div>
          )}

          <DataTable
            columns={uptimeColumns}
            data={uptime.urls}
            searchPlaceholder="Search URLs…"
            defaultSorting={[{ id: 'uptimePct', desc: false }]}
          />
        </div>
      )}

      {/* ── Recent runs ──────────────────────────────────────────────── */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Recent runs</h3>
        {recentRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <DataTable
            columns={runColumns}
            data={recentRuns}
            searchPlaceholder="Search runs…"
            defaultSorting={[{ id: 'started_at', desc: true }]}
            onRowClick={(run) =>
              navigate({ to: '/history/$runId', params: { runId: String(run.id) } })
            }
          />
        )}
      </div>
    </div>
  );
}
