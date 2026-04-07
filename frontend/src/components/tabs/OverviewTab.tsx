import { useNavigate } from '@tanstack/react-router';
import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CHART_TOOLTIP_STYLE, getColor } from '@/lib/chartStyles';
import { formatChartDate } from '@/lib/formatChartDate';
import { formatDate, formatDuration, formatMs } from '@/lib/formatters';
import type { GroupOverview, GroupPerformance, GroupUptime, Run } from '@/lib/types';
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

// ── Main component ─────────────────────────────────────────────────────────────

interface OverviewTabProps {
  overview: GroupOverview | undefined;
  performance: GroupPerformance | undefined;
  uptime: GroupUptime | undefined;
}

export function OverviewTab({ overview, performance, uptime }: OverviewTabProps) {
  const navigate = useNavigate();
  if (!overview) return null;

  const { recentRuns, series } = overview;

  // Latest and previous series point for trend deltas
  const latest = series.length > 0 ? series[series.length - 1] : null;
  const previous = series.length > 1 ? series[series.length - 2] : null;

  const hasSeoTile = latest?.avgSeoScore != null;

  // Performance chart: one line per URL
  const perfUrls = performance
    ? [...new Set(performance.loadTimeTrend.map((p) => p.url))].slice(0, 8)
    : [];
  const byRun = new Map<string, Record<string, string | number>>();
  if (performance) {
    for (const p of performance.loadTimeTrend) {
      let row = byRun.get(p.startedAt);
      if (!row) {
        row = { startedAt: p.startedAt };
        byRun.set(p.startedAt, row);
      }
      row[p.url] = p.avgLoadTimeMs;
    }
  }
  const perfChartData = [...byRun.values()];

  const slowCount = performance ? performance.urls.filter((u) => u.isSlow).length : 0;
  const downCount = uptime ? uptime.urls.filter((u) => u.lastStatus === 'down').length : 0;

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

          {perfChartData.length > 1 && perfUrls.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <h3 className="text-sm font-medium">Load time trend per URL</h3>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart
                    data={perfChartData}
                    margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
                  >
                    <XAxis
                      dataKey="startedAt"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={formatChartDate}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => formatMs(v)}
                    />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelFormatter={formatChartDate}
                      formatter={(v, name) => [
                        formatMs(Number(v)),
                        String(name).split('/').pop() ?? String(name),
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 10 }}
                      formatter={(v) => v.split('/').pop() ?? v}
                    />
                    {perfUrls.map((url, i) => (
                      <Line
                        key={url}
                        type="monotone"
                        dataKey={url}
                        stroke={getColor(i)}
                        dot={false}
                        strokeWidth={2}
                        activeDot={{ r: 3 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
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
