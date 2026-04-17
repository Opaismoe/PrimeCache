import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { createColumnHelper } from '@tanstack/react-table';
import { useCallback, useId, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { CHART_TOOLTIP_STYLE } from '@/lib/chartStyles';
import { formatChartDate } from '@/lib/formatChartDate';
import { formatDate, formatDuration, formatMs } from '@/lib/formatters';
import type {
  GroupOverview,
  GroupPerformance,
  GroupUptime,
  Run,
  UrlPerformance,
  UrlUptime,
} from '@/lib/types';
import { getGroupCrawledUrls } from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import { ExternalLink } from '../ExternalLink';
import { RunResults } from '../RunResults';
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

// ── Per-URL trend tile ────────────────────────────────────────────────────────

function loadTimeColor(ms: number): string {
  if (ms <= 500) return '#22c55e';
  if (ms >= 3000) return '#ef4444';
  if (ms <= 1500) {
    const t = (ms - 500) / 1000;
    return lerpHex('#22c55e', '#eab308', t);
  }
  const t = (ms - 1500) / 1500;
  return lerpHex('#eab308', '#ef4444', t);
}

function lerpHex(a: string, b: string, t: number): string {
  const ca = parseInt(a.slice(1), 16);
  const cb = parseInt(b.slice(1), 16);
  const ar = (ca >> 16) & 0xff;
  const ag = (ca >> 8) & 0xff;
  const ab = ca & 0xff;
  const br = (cb >> 16) & 0xff;
  const bg = (cb >> 8) & 0xff;
  const bb = cb & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const b2 = Math.round(ab + (bb - ab) * t);
  return `#${((r << 16) | (g << 8) | b2).toString(16).padStart(6, '0')}`;
}

function UrlTrendTile({
  url,
  trend,
  isCrawled,
  isPinned,
  onPin,
  onUnpin,
  onRemove,
}: {
  url: string;
  trend: { startedAt: string; avgLoadTimeMs: number }[];
  isCrawled: boolean;
  isPinned: boolean;
  onPin: () => void;
  onUnpin: () => void;
  onRemove: () => void;
}) {
  const latest = trend.length > 0 ? trend[trend.length - 1] : null;
  const previous = trend.length > 1 ? trend[trend.length - 2] : null;
  const delta = latest && previous ? latest.avgLoadTimeMs - previous.avgLoadTimeMs : null;

  const gradientId = `spark${useId().replace(/:/g, '')}`;

  return (
    <Card className={isPinned ? 'ring-1 ring-primary/40' : ''}>
      <CardContent className="pt-3 pb-3 px-3 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            {isCrawled && (
              <Badge variant="secondary" className="w-fit text-[10px] px-1.5 py-0">
                Crawled
              </Badge>
            )}
            <ExternalLink
              href={url}
              className="truncate font-mono text-[11px] text-muted-foreground leading-tight"
            >
              {url}
            </ExternalLink>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              title={isPinned ? 'Unpin' : 'Pin'}
              onClick={isPinned ? onUnpin : onPin}
              className={`rounded p-0.5 text-xs transition-colors hover:bg-muted ${isPinned ? 'text-primary' : 'text-muted-foreground'}`}
            >
              {isPinned ? '📌' : '📍'}
            </button>
            {!isPinned && (
              <button
                type="button"
                title="Remove"
                onClick={onRemove}
                className="rounded p-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Load time + delta */}
        {latest ? (
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold tabular-nums">
              {formatMs(latest.avgLoadTimeMs)}
            </span>
            {delta != null && Math.abs(delta) > 50 && (
              <span
                className={`text-xs font-medium ${delta > 0 ? 'text-destructive' : 'text-green-500'}`}
              >
                {delta > 0 ? `+${formatMs(delta)}` : `-${formatMs(Math.abs(delta))}`}
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No data yet</p>
        )}

        {/* Sparkline */}
        {trend.length > 1 && (
          <ResponsiveContainer width="100%" height={52}>
            <LineChart data={trend} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                  {trend.map((p, i) => (
                    <stop
                      key={`${p.startedAt}-${i}`}
                      offset={`${(i / (trend.length - 1)) * 100}%`}
                      stopColor={loadTimeColor(p.avgLoadTimeMs)}
                    />
                  ))}
                </linearGradient>
              </defs>
              <YAxis hide domain={['dataMin - 200', 'dataMax + 200']} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelFormatter={formatChartDate}
                formatter={(v) => [formatMs(Number(v)), 'Avg load']}
              />
              <Line
                type="monotone"
                dataKey="avgLoadTimeMs"
                stroke={`url(#${gradientId})`}
                dot={false}
                strokeWidth={1.5}
                activeDot={{ r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ── localStorage pin/remove state ─────────────────────────────────────────────

function useLocalSet(key: string) {
  const [set, setSet] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const add = useCallback(
    (url: string) =>
      setSet((prev) => {
        const next = new Set(prev).add(url);
        localStorage.setItem(key, JSON.stringify([...next]));
        return next;
      }),
    [key],
  );

  const remove = useCallback(
    (url: string) =>
      setSet((prev) => {
        const next = new Set(prev);
        next.delete(url);
        localStorage.setItem(key, JSON.stringify([...next]));
        return next;
      }),
    [key],
  );

  return { set, add, remove };
}

// ── Column definitions ────────────────────────────────────────────────────────

const perfColumnHelper = createColumnHelper<UrlPerformance>();
const perfColumns = [
  perfColumnHelper.accessor('url', {
    header: 'URL',
    cell: (info) => (
      <div className="flex items-center gap-2">
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
];

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
  groupName: string;
  overview: GroupOverview | undefined;
  performance: GroupPerformance | undefined;
  uptime: GroupUptime | undefined;
}

export function OverviewTab({ groupName, overview, performance, uptime }: Props) {
  const navigate = useNavigate();

  // All hooks must be called before any early return
  const { data: crawledUrlsData = [] } = useQuery({
    queryKey: queryKeys.groups.crawledUrls(groupName),
    queryFn: () => getGroupCrawledUrls(groupName),
  });
  const pinned = useLocalSet(`overview-pinned:${groupName}`);
  const hidden = useLocalSet(`overview-hidden:${groupName}`);
  const [showHidden, setShowHidden] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (!overview) return null;

  const { recentRuns, series } = overview;

  const latest = series.length > 0 ? series[series.length - 1] : null;
  const previous = series.length > 1 ? series[series.length - 2] : null;
  const hasSeoTile = latest?.avgSeoScore != null;

  const slowCount = performance ? performance.urls.filter((u) => u.isSlow).length : 0;
  const downCount = uptime ? uptime.urls.filter((u) => u.lastStatus === 'down').length : 0;

  // Build per-URL trend data
  const trendByUrl = new Map<string, { startedAt: string; avgLoadTimeMs: number }[]>();
  if (performance) {
    for (const p of performance.loadTimeTrend) {
      if (!trendByUrl.has(p.url)) trendByUrl.set(p.url, []);
      const entry = trendByUrl.get(p.url);
      if (entry) entry.push({ startedAt: p.startedAt, avgLoadTimeMs: p.avgLoadTimeMs });
    }
  }

  // Collect all known URLs: configured (from performance) + crawled (from DB)
  const configUrlSet = new Set(performance?.urls.map((u) => u.url) ?? []);
  const crawledUrlSet = new Set(crawledUrlsData.map((c) => c.url));
  const allUrls: { url: string; isCrawled: boolean }[] = [
    ...[...configUrlSet].map((url) => ({ url, isCrawled: crawledUrlSet.has(url) })),
    ...[...crawledUrlSet]
      .filter((url) => !configUrlSet.has(url))
      .map((url) => ({ url, isCrawled: true })),
  ];

  // Separate pinned and unpinned (respecting hidden)
  const pinnedItems = allUrls.filter((u) => pinned.set.has(u.url));
  const unpinnedVisible = allUrls.filter((u) => !pinned.set.has(u.url) && !hidden.set.has(u.url));
  const hiddenItems = allUrls.filter((u) => !pinned.set.has(u.url) && hidden.set.has(u.url));

  const renderTile = ({ url, isCrawled }: { url: string; isCrawled: boolean }) => (
    <UrlTrendTile
      key={url}
      url={url}
      trend={trendByUrl.get(url) ?? []}
      isCrawled={isCrawled}
      isPinned={pinned.set.has(url)}
      onPin={() => {
        pinned.add(url);
        hidden.remove(url);
      }}
      onUnpin={() => pinned.remove(url)}
      onRemove={() => hidden.add(url)}
    />
  );

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

          <div className="mb-4">
            <DataTable
              columns={perfColumns}
              data={performance.urls}
              searchPlaceholder="Search URLs…"
              defaultSorting={[{ id: 'p95LoadTimeMs', desc: true }]}
            />
          </div>

          {/* Per-URL trend tiles */}
          {allUrls.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-medium text-muted-foreground">
                  Load time trend per URL
                </h4>
                {pinnedItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    {showAll ? 'Pinned only' : `Show all (${unpinnedVisible.length} more)`}
                  </button>
                )}
              </div>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {pinnedItems.map(renderTile)}
                {(pinnedItems.length <= 1 || showAll) && unpinnedVisible.map(renderTile)}
              </div>

              {hiddenItems.length > 0 && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowHidden((v) => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    {showHidden
                      ? 'Hide removed'
                      : `Show ${hiddenItems.length} removed URL${hiddenItems.length !== 1 ? 's' : ''}`}
                  </button>
                  {showHidden && (
                    <div className="mt-2 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 opacity-50">
                      {hiddenItems.map(({ url }) => (
                        <Card key={url} className="border-dashed">
                          <CardContent className="pt-3 pb-3 px-3">
                            <div className="flex items-center justify-between gap-2">
                              <ExternalLink
                                href={url}
                                className="truncate font-mono text-[11px] text-muted-foreground"
                              >
                                {url}
                              </ExternalLink>
                              <button
                                type="button"
                                onClick={() => hidden.remove(url)}
                                className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                              >
                                Restore
                              </button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
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
