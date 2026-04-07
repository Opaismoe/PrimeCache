import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CHART_TOOLTIP_STYLE } from '@/lib/chartStyles';
import { formatChartDate } from '@/lib/formatChartDate';
import { formatDate, formatDuration, formatMs } from '@/lib/formatters';
import type { GroupOverview, GroupPerformance, GroupUptime, Run } from '@/lib/types';
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

  const trendColor =
    delta == null
      ? 'hsl(var(--muted-foreground))'
      : delta > 50
        ? 'hsl(var(--destructive))'
        : delta < -50
          ? '#22c55e'
          : 'hsl(var(--primary))';

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
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelFormatter={formatChartDate}
                formatter={(v) => [formatMs(Number(v)), 'Avg load']}
              />
              <Line
                type="monotone"
                dataKey="avgLoadTimeMs"
                stroke={trendColor}
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
    ...[...configUrlSet].map((url) => ({ url, isCrawled: false })),
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

          <div className="mb-4 rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>P50 Load</TableHead>
                  <TableHead>P95 Load</TableHead>
                  <TableHead>P50 TTFB</TableHead>
                  <TableHead>P95 TTFB</TableHead>
                  <TableHead>Samples</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {performance.urls.map((u) => (
                  <TableRow key={u.url}>
                    <TableCell className="max-w-xs truncate font-mono text-xs">
                      <div className="flex items-center gap-2">
                        {u.isSlow && (
                          <Badge variant="destructive" className="shrink-0 text-xs">
                            Slow
                          </Badge>
                        )}
                        <ExternalLink href={u.url} className="truncate">
                          {u.url}
                        </ExternalLink>
                      </div>
                    </TableCell>
                    <TableCell>{formatMs(u.p50LoadTimeMs)}</TableCell>
                    <TableCell className={u.isSlow ? 'text-destructive font-medium' : ''}>
                      {formatMs(u.p95LoadTimeMs)}
                    </TableCell>
                    <TableCell>{u.p50TtfbMs != null ? formatMs(u.p50TtfbMs) : '—'}</TableCell>
                    <TableCell>{u.p95TtfbMs != null ? formatMs(u.p95TtfbMs) : '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{u.sampleCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Uptime</TableHead>
                  <TableHead>Down</TableHead>
                  <TableHead>Checks</TableHead>
                  <TableHead>Last status</TableHead>
                  <TableHead>Last checked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uptime.urls.map((u) => (
                  <TableRow key={u.url}>
                    <TableCell className="max-w-xs truncate font-mono text-xs">
                      <ExternalLink href={u.url} className="truncate">
                        {u.url}
                      </ExternalLink>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          u.uptimePct >= 99
                            ? 'text-green-500 font-medium'
                            : u.uptimePct >= 95
                              ? 'text-yellow-500 font-medium'
                              : 'text-destructive font-medium'
                        }
                      >
                        {u.uptimePct.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.downCount}</TableCell>
                    <TableCell className="text-muted-foreground">{u.totalChecks}</TableCell>
                    <TableCell>
                      <Badge
                        variant={u.lastStatus === 'up' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {u.lastStatus === 'up' ? 'Up' : 'Down'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(u.lastCheckedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ── Recent runs ──────────────────────────────────────────────── */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Recent runs</h3>
        {recentRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Results</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRuns.map((run: Run) => (
                  <TableRow
                    key={run.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() =>
                      navigate({ to: '/history/$runId', params: { runId: String(run.id) } })
                    }
                  >
                    <TableCell className="text-muted-foreground">#{run.id}</TableCell>
                    <TableCell>{formatDate(run.started_at)}</TableCell>
                    <TableCell>{formatDuration(run.started_at, run.ended_at)}</TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                    <TableCell>
                      <RunResults
                        successCount={run.success_count}
                        failureCount={run.failure_count}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
