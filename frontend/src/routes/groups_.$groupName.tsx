import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryOptions } from '@tanstack/react-query';
import { useState } from 'react';
import { getGroupOverview, getGroupPerformance, getGroupUptime, getGroupSeo, getGroupBrokenLinks, getGroupExportUrl, triggerAsync, getConfig } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { StatusBadge } from '../components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { formatDate, formatDuration, formatMs } from '../lib/formatters';
import { describeCron } from '../lib/cronUtils';
import type { UrlPerformance, UrlUptime, UrlSeoSummary, BrokenLinkSummary } from '../lib/types';

const LINE_COLORS = ['#60a5fa', '#a78bfa', '#34d399', '#f472b6', '#fb923c', '#e879f9'];
const getColor = (i: number) => LINE_COLORS[i % LINE_COLORS.length];

export const Route = createFileRoute('/groups_/$groupName')({
  loader: ({ context: { queryClient }, params }) => {
    const name = params.groupName;
    return Promise.all([
      queryClient.ensureQueryData(
        queryOptions({ queryKey: queryKeys.groups.overview(name), queryFn: () => getGroupOverview(name) }),
      ),
      queryClient.ensureQueryData(
        queryOptions({ queryKey: queryKeys.config.all(), queryFn: getConfig }),
      ),
    ]);
  },
  pendingComponent: GroupDetailSkeleton,
  pendingMs: 200,
  pendingMinMs: 300,
  component: GroupDetailPage,
});

// ── Skeleton ─────────────────────────────────────────────────────────────────

function GroupDetailSkeleton() {
  return (
    <div>
      <Skeleton className="mb-1 h-4 w-28" />
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Skeleton className="mb-1.5 h-7 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="mb-1.5 h-3 w-16" />
              <Skeleton className="h-6 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="mb-4 h-10 w-80" />
      <div className="rounded-lg border border-border">
        <div className="p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="mb-2 h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function GroupDetailPage() {
  const { groupName } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: overview } = useQuery(
    queryOptions({ queryKey: queryKeys.groups.overview(groupName), queryFn: () => getGroupOverview(groupName) }),
  );

  const { data: config } = useQuery(
    queryOptions({ queryKey: queryKeys.config.all(), queryFn: getConfig }),
  );

  const { data: performance, isLoading: perfLoading } = useQuery({
    queryKey: queryKeys.groups.performance(groupName),
    queryFn: () => getGroupPerformance(groupName),
    enabled: activeTab === 'performance',
  });

  const { data: uptime, isLoading: uptimeLoading } = useQuery({
    queryKey: queryKeys.groups.uptime(groupName),
    queryFn: () => getGroupUptime(groupName),
    enabled: activeTab === 'uptime',
  });

  const { data: seo, isLoading: seoLoading } = useQuery({
    queryKey: queryKeys.groups.seo(groupName),
    queryFn: () => getGroupSeo(groupName),
    enabled: activeTab === 'seo',
  });

  const { data: brokenLinks, isLoading: linksLoading } = useQuery({
    queryKey: queryKeys.groups.brokenLinks(groupName),
    queryFn: () => getGroupBrokenLinks(groupName),
    enabled: activeTab === 'links',
  });

  const trigger = useMutation({
    mutationFn: () => triggerAsync(groupName),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.runs.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.overview(groupName) });
      navigate({ to: '/history/$runId', params: { runId: String(data.runId) } });
    },
  });

  const group = config?.groups.find((g) => g.name === groupName);
  const stats = overview?.stats;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Dashboard</Link>
        <span>/</span>
        <span>{groupName}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{groupName}</h1>
          {group && (
            <p className="text-sm text-muted-foreground">{describeCron(group.schedule)}</p>
          )}
        </div>
        <Button onClick={() => trigger.mutate()} disabled={trigger.isPending}>
          {trigger.isPending ? 'Starting…' : 'Run now'}
        </Button>
      </div>

      {/* Quick stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total runs" value={stats ? String(stats.totalRuns) : '—'} />
        <StatCard label="Success rate" value={stats ? `${stats.successRate.toFixed(1)}%` : '—'} />
        <StatCard label="Avg load time" value={stats ? formatMs(stats.avgLoadTimeMs) : '—'} />
        <StatCard label="Avg TTFB" value={stats?.avgTtfbMs != null ? formatMs(stats.avgTtfbMs) : '—'} />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="uptime">Uptime</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
          </TabsList>
          {['performance', 'uptime', 'seo', 'links'].includes(activeTab) && (
            <a
              href={getGroupExportUrl(groupName, activeTab)}
              download
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Export CSV
            </a>
          )}
        </div>

        {/* ── Overview ── */}
        <TabsContent value="overview">
          <OverviewTab overview={overview} />
        </TabsContent>

        {/* ── Performance ── */}
        <TabsContent value="performance">
          {perfLoading ? (
            <TabLoadingSkeleton rows={6} cols={6} />
          ) : performance ? (
            <PerformanceTab data={performance} />
          ) : null}
        </TabsContent>

        {/* ── Uptime ── */}
        <TabsContent value="uptime">
          {uptimeLoading ? (
            <TabLoadingSkeleton rows={5} cols={4} />
          ) : uptime ? (
            <UptimeTab data={uptime} />
          ) : null}
        </TabsContent>

        {/* ── SEO ── */}
        <TabsContent value="seo">
          {seoLoading ? (
            <TabLoadingSkeleton rows={5} cols={4} />
          ) : seo ? (
            <SeoTab data={seo} />
          ) : (
            <p className="text-sm text-muted-foreground">No SEO data yet — run the group to collect it.</p>
          )}
        </TabsContent>

        {/* ── Links ── */}
        <TabsContent value="links">
          {linksLoading ? (
            <TabLoadingSkeleton rows={5} cols={5} />
          ) : brokenLinks ? (
            <LinksTab data={brokenLinks} />
          ) : (
            <p className="text-sm text-muted-foreground">No broken link data yet. Enable <code>checkBrokenLinks: true</code> in config and run the group.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function TabLoadingSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: cols }).map((_, i) => (
              <TableHead key={i}><Skeleton className="h-4 w-20" /></TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: cols }).map((_, j) => (
                <TableCell key={j}><Skeleton className="h-4 w-full max-w-[120px]" /></TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ overview }: { overview: ReturnType<typeof useQuery<any>>['data'] }) {
  if (!overview) return null;

  const { recentRuns, series } = overview;

  return (
    <div>
      {/* Charts */}
      {series.length > 1 && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-medium">Success rate per run</h3>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <XAxis dataKey="runId" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `#${v}`} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                    formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Success rate']}
                  />
                  <Line type="monotone" dataKey="successRate" stroke="#4ade80" dot={false} strokeWidth={2} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-medium">Avg load time per run</h3>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <XAxis dataKey="runId" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `#${v}`} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => formatMs(v)} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                    formatter={(v) => [formatMs(Number(v)), 'Avg load']}
                  />
                  <Line type="monotone" dataKey="avgLoadTimeMs" stroke="#60a5fa" dot={false} strokeWidth={2} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent runs table */}
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
              {recentRuns.map((run: any) => (
                <TableRow
                  key={run.id}
                  className="cursor-pointer"
                  onClick={() => {/* navigate handled by link below */}}
                >
                  <TableCell>
                    <Link
                      to="/history/$runId"
                      params={{ runId: String(run.id) }}
                      className="text-muted-foreground hover:text-foreground hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      #{run.id}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(run.started_at)}</TableCell>
                  <TableCell>{formatDuration(run.started_at, run.ended_at)}</TableCell>
                  <TableCell><StatusBadge status={run.status} /></TableCell>
                  <TableCell>
                    {run.success_count !== null ? (
                      <span>
                        <span className="text-green-500">{run.success_count} ok</span>
                        {run.failure_count ? (
                          <span className="ml-2 text-destructive">{run.failure_count} failed</span>
                        ) : null}
                      </span>
                    ) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Performance Tab ───────────────────────────────────────────────────────────

function PerformanceTab({ data }: { data: { urls: UrlPerformance[]; loadTimeTrend: any[] } }) {
  const slowCount = data.urls.filter((u) => u.isSlow).length;

  // Build multi-line chart data: group by runId, each URL is a key
  const urlList = [...new Set(data.loadTimeTrend.map((p) => p.url))].slice(0, 6);
  const byRun = new Map<number, Record<string, any>>();
  for (const p of data.loadTimeTrend) {
    if (!byRun.has(p.runId)) byRun.set(p.runId, { runId: p.runId, startedAt: p.startedAt });
    byRun.get(p.runId)![p.url] = p.avgLoadTimeMs;
  }
  const chartData = [...byRun.values()];

  return (
    <div>
      {slowCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span className="font-medium">{slowCount} slow {slowCount === 1 ? 'page' : 'pages'}</span>
          <span className="text-muted-foreground">— P95 load time exceeds 3s</span>
        </div>
      )}

      <div className="mb-6 rounded-lg border border-border">
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
            {data.urls.map((u) => (
              <TableRow key={u.url}>
                <TableCell className="max-w-xs truncate font-mono text-xs">
                  <div className="flex items-center gap-2">
                    {u.isSlow && (
                      <Badge variant="destructive" className="shrink-0 text-xs">Slow</Badge>
                    )}
                    <a
                      href={u.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate hover:text-foreground hover:underline"
                    >
                      {u.url}
                    </a>
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

      {chartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-medium">Load time trend per URL</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <XAxis dataKey="runId" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `#${v}`} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => formatMs(v)} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                  formatter={(v, name) => [formatMs(Number(v)), String(name).split('/').pop() ?? String(name)]}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} formatter={(v) => v.split('/').pop() ?? v} />
                {urlList.map((url, i) => (
                  <Line key={url} type="monotone" dataKey={url} stroke={getColor(i)} dot={false} strokeWidth={2} activeDot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Uptime Tab ────────────────────────────────────────────────────────────────

function UptimeTab({ data }: { data: { urls: UrlUptime[]; timeline: any[] } }) {
  const downNow = data.urls.filter((u) => u.lastStatus === 'down').length;

  // Build scatter chart data for status timeline
  const timelineData = data.timeline.map((p) => ({
    ...p,
    y: data.urls.findIndex((u) => u.url === p.url),
    value: p.isDown ? 0 : 1,
  }));

  return (
    <div>
      {downNow > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span className="font-medium">{downNow} {downNow === 1 ? 'URL' : 'URLs'} currently down</span>
        </div>
      )}

      <div className="mb-6 rounded-lg border border-border">
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
            {data.urls.map((u) => (
              <TableRow key={u.url}>
                <TableCell className="max-w-xs truncate font-mono text-xs">
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate hover:text-foreground hover:underline"
                  >
                    {u.url}
                  </a>
                </TableCell>
                <TableCell>
                  <span className={u.uptimePct >= 99 ? 'text-green-500 font-medium' : u.uptimePct >= 95 ? 'text-yellow-500 font-medium' : 'text-destructive font-medium'}>
                    {u.uptimePct.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.downCount}</TableCell>
                <TableCell className="text-muted-foreground">{u.totalChecks}</TableCell>
                <TableCell>
                  <Badge variant={u.lastStatus === 'up' ? 'default' : 'destructive'} className="text-xs">
                    {u.lastStatus === 'up' ? 'Up' : 'Down'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{formatDate(u.lastCheckedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {timelineData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-medium">Status history (recent visits)</h3>
            <p className="text-xs text-muted-foreground">Green = up, Red = down</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(120, data.urls.length * 28 + 40)}>
              <ScatterChart margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <XAxis
                  dataKey="visitedAt"
                  type="category"
                  hide
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  domain={[-1, data.urls.length]}
                  tick={false}
                  width={0}
                />
                <ZAxis range={[30, 30]} />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    return (
                      <div style={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, padding: '6px 10px', fontSize: 11 }}>
                        <p className="font-mono text-xs truncate max-w-[200px]">{d.url}</p>
                        <p>{formatDate(d.visitedAt)}</p>
                        <p className={d.isDown ? 'text-destructive' : 'text-green-500'}>{d.isDown ? 'Down' : 'Up'}</p>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={timelineData}
                  fill="#4ade80"
                  shape={(props: any) => {
                    const { cx, cy, payload } = props;
                    return <circle cx={cx} cy={cy} r={5} fill={payload.isDown ? '#f87171' : '#4ade80'} opacity={0.85} />;
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── SEO Tab ───────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 80) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  return 'text-destructive';
}

function SeoFieldRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-3 py-1 text-xs border-b border-border last:border-0">
      <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
      <span className={value ? 'font-mono break-all' : 'italic text-muted-foreground'}>
        {value ?? 'not set'}
      </span>
    </div>
  );
}

function SeoTab({ data }: { data: { urls: UrlSeoSummary[] } }) {
  const issueCount = data.urls.reduce((n, u) => n + u.issues.length, 0);
  const changedCount = data.urls.filter((u) => u.changed).length;

  return (
    <div>
      {/* Summary bar */}
      <div className="mb-4 flex flex-wrap gap-3">
        {issueCount > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span className="font-medium">{issueCount} SEO {issueCount === 1 ? 'issue' : 'issues'}</span>
            <span className="text-muted-foreground">across {data.urls.filter(u => u.issues.length > 0).length} URLs</span>
          </div>
        )}
        {changedCount > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
            <span className="font-medium">{changedCount} {changedCount === 1 ? 'URL' : 'URLs'} changed</span>
            <span className="text-muted-foreground">since last run</span>
          </div>
        )}
        {data.urls.length === 0 && (
          <p className="text-sm text-muted-foreground">No SEO data yet — run the group to collect it.</p>
        )}
      </div>

      {/* Per-URL cards */}
      <div className="flex flex-col gap-3">
        {data.urls.map((u) => (
          <Card key={u.url}>
            <CardContent className="pt-4">
              {/* Header row */}
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {u.changed && (
                    <Badge variant="outline" className="shrink-0 border-yellow-500 text-yellow-600 dark:text-yellow-400 text-xs">Changed</Badge>
                  )}
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate font-mono text-xs hover:text-foreground hover:underline text-muted-foreground"
                  >
                    {u.url}
                  </a>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-lg font-bold ${scoreColor(u.score)}`}>{u.score}</span>
                  <span className="text-xs text-muted-foreground">/ 100</span>
                </div>
              </div>

              {/* Issues */}
              {u.issues.length > 0 && (
                <div className="mb-3 rounded-md bg-destructive/10 px-3 py-2">
                  <ul className="space-y-0.5">
                    {u.issues.map((issue) => (
                      <li key={issue} className="flex items-start gap-1.5 text-xs text-destructive">
                        <span className="mt-0.5 shrink-0">✕</span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* SEO fields */}
              {u.latestSeo && (
                <div className="rounded-md border border-border px-3 py-1">
                  <SeoFieldRow label="Title" value={u.latestSeo.title} />
                  <SeoFieldRow label="Meta description" value={u.latestSeo.metaDescription} />
                  <SeoFieldRow label="H1" value={u.latestSeo.h1} />
                  <SeoFieldRow label="Canonical URL" value={u.latestSeo.canonicalUrl} />
                  <SeoFieldRow label="og:title" value={u.latestSeo.ogTitle} />
                  <SeoFieldRow label="og:description" value={u.latestSeo.ogDescription} />
                  <SeoFieldRow label="og:image" value={u.latestSeo.ogImage} />
                  <SeoFieldRow label="Robots" value={u.latestSeo.robotsMeta} />
                </div>
              )}

              {/* History diff (last 2 runs) */}
              {u.changed && u.history.length >= 2 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Changes since previous run</p>
                  <div className="space-y-1">
                    {(['title', 'metaDescription', 'h1', 'canonicalUrl'] as const).map((field) => {
                      const prev = u.history[1].seo[field];
                      const curr = u.history[0].seo[field];
                      if (prev === curr) return null;
                      const labels: Record<string, string> = {
                        title: 'Title', metaDescription: 'Meta description', h1: 'H1', canonicalUrl: 'Canonical',
                      };
                      return (
                        <div key={field} className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs">
                          <span className="font-medium text-yellow-600 dark:text-yellow-400">{labels[field]}</span>
                          <div className="mt-1 text-muted-foreground line-through">{prev ?? '(empty)'}</div>
                          <div className="mt-0.5 text-foreground">{curr ?? '(empty)'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Links Tab ─────────────────────────────────────────────────────────────────

function LinksTab({ data }: { data: BrokenLinkSummary[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No broken links found — all discovered links returned 2xx/3xx responses.</p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <span className="font-medium">{data.length} broken {data.length === 1 ? 'link' : 'links'} detected</span>
      </div>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>URL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>Occurrences</TableHead>
              <TableHead>Last seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((l) => (
              <TableRow key={l.url}>
                <TableCell className="max-w-xs truncate font-mono text-xs">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground hover:underline text-muted-foreground"
                  >
                    {l.url}
                  </a>
                </TableCell>
                <TableCell>
                  {l.statusCode != null ? (
                    <Badge variant="destructive" className="text-xs">{l.statusCode}</Badge>
                  ) : '—'}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                  {l.error ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">{l.occurrences}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(l.lastSeenAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
