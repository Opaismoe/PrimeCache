import {
  Area,
  AreaChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { CHART_TOOLTIP_STYLE, getColor } from '@/lib/chartStyles';
import { formatChartDate } from '@/lib/formatChartDate';
import { formatMs } from '@/lib/formatters';
import { ExternalLink } from '../ExternalLink';
import type { CwvStatus, GroupCwv, UrlCwv, UrlSeoSummary } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 80) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  return 'text-destructive';
}

const CWV_STATUS_COLOR: Record<CwvStatus, string> = {
  good: 'text-green-500',
  'needs-improvement': 'text-yellow-500',
  poor: 'text-destructive',
};

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

function CwvTile({
  label,
  value,
  unit,
  status,
}: {
  label: string;
  value: number | null;
  unit: string;
  status: CwvStatus | null;
}) {
  const color = status ? CWV_STATUS_COLOR[status] : 'text-muted-foreground';
  return (
    <div className="flex flex-col items-center rounded-lg border border-border p-3 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {value != null ? (
        <>
          <p className={`text-xl font-semibold tabular-nums ${color}`}>
            {value}
            {unit}
          </p>
          {status && (
            <p className={`text-xs mt-0.5 ${color}`}>
              {status === 'needs-improvement'
                ? 'Needs work'
                : status.charAt(0).toUpperCase() + status.slice(1)}
            </p>
          )}
        </>
      ) : (
        <p className="text-lg text-muted-foreground">—</p>
      )}
    </div>
  );
}

function CwvUrlTrendCharts({ urlTrend }: { urlTrend: GroupCwv['urlTrend'] }) {
  const urlList = [...new Set(urlTrend.map((p) => p.url))].slice(0, 6);
  const byRun = new Map<string, Record<string, string | number>>();
  for (const p of urlTrend) {
    let row = byRun.get(p.startedAt);
    if (!row) {
      row = { startedAt: p.startedAt };
      byRun.set(p.startedAt, row);
    }
    if (p.avgLcpMs != null) row[`lcp::${p.url}`] = p.avgLcpMs;
    if (p.avgClsScore != null) row[`cls::${p.url}`] = p.avgClsScore;
    if (p.avgTtfbMs != null) row[`ttfb::${p.url}`] = p.avgTtfbMs;
  }
  const urlChartData = [...byRun.values()];

  if (urlChartData.length <= 1) return null;

  const legendFormatter = (v: string) => v.split('::')[1]?.split('/').pop() ?? v;

  const chartProps = {
    margin: { top: 4, right: 8, bottom: 0, left: -16 },
    xAxisProps: {
      dataKey: 'startedAt' as const,
      tick: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' },
      tickFormatter: formatChartDate,
    },
  };

  return (
    <div className="mt-4 flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-2">
          <h3 className="text-sm font-medium">LCP trend per URL</h3>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={urlChartData} {...chartProps}>
              <XAxis {...chartProps.xAxisProps} />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => formatMs(v)}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelFormatter={formatChartDate}
                formatter={(v, name) => [
                  formatMs(Number(v)),
                  String(name).replace('lcp::', '').split('/').pop() ?? '',
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} formatter={legendFormatter} />
              {urlList.map((url, i) => (
                <Area
                  key={url}
                  type="monotone"
                  dataKey={`lcp::${url}`}
                  stroke={getColor(i)}
                  fill={getColor(i)}
                  fillOpacity={0.08}
                  dot={false}
                  strokeWidth={2}
                  activeDot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <h3 className="text-sm font-medium">CLS trend per URL</h3>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={urlChartData} {...chartProps}>
              <XAxis {...chartProps.xAxisProps} />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => Number(v).toFixed(3)}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelFormatter={formatChartDate}
                formatter={(v, name) => [
                  Number(v).toFixed(3),
                  String(name).replace('cls::', '').split('/').pop() ?? '',
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} formatter={legendFormatter} />
              {urlList.map((url, i) => (
                <Area
                  key={url}
                  type="monotone"
                  dataKey={`cls::${url}`}
                  stroke={getColor(i)}
                  fill={getColor(i)}
                  fillOpacity={0.08}
                  dot={false}
                  strokeWidth={2}
                  activeDot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <h3 className="text-sm font-medium">TTFB trend per URL</h3>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={urlChartData} {...chartProps}>
              <XAxis {...chartProps.xAxisProps} />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => formatMs(v)}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelFormatter={formatChartDate}
                formatter={(v, name) => [
                  formatMs(Number(v)),
                  String(name).replace('ttfb::', '').split('/').pop() ?? '',
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} formatter={legendFormatter} />
              {urlList.map((url, i) => (
                <Area
                  key={url}
                  type="monotone"
                  dataKey={`ttfb::${url}`}
                  stroke={getColor(i)}
                  fill={getColor(i)}
                  fillOpacity={0.08}
                  dot={false}
                  strokeWidth={2}
                  activeDot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function CwvSection({ cwv }: { cwv: GroupCwv }) {
  const aggregate = cwv.urls.reduce<{
    lcp: number | null;
    fcp: number | null;
    cls: number | null;
    inp: number | null;
    lcpStatus: CwvStatus | null;
    fcpStatus: CwvStatus | null;
    clsStatus: CwvStatus | null;
    inpStatus: CwvStatus | null;
  }>(
    (acc, u) => ({
      lcp: acc.lcp === null ? u.lcpP75 : u.lcpP75 !== null ? Math.max(acc.lcp, u.lcpP75) : acc.lcp,
      fcp: acc.fcp === null ? u.fcpP75 : u.fcpP75 !== null ? Math.max(acc.fcp, u.fcpP75) : acc.fcp,
      cls: acc.cls === null ? u.clsP75 : u.clsP75 !== null ? Math.max(acc.cls, u.clsP75) : acc.cls,
      inp: acc.inp === null ? u.inpP75 : u.inpP75 !== null ? Math.max(acc.inp, u.inpP75) : acc.inp,
      lcpStatus:
        acc.lcpStatus === null
          ? u.lcpStatus
          : u.lcpStatus === 'poor'
            ? 'poor'
            : acc.lcpStatus === 'poor'
              ? 'poor'
              : (u.lcpStatus ?? acc.lcpStatus),
      fcpStatus:
        acc.fcpStatus === null
          ? u.fcpStatus
          : u.fcpStatus === 'poor'
            ? 'poor'
            : acc.fcpStatus === 'poor'
              ? 'poor'
              : (u.fcpStatus ?? acc.fcpStatus),
      clsStatus:
        acc.clsStatus === null
          ? u.clsStatus
          : u.clsStatus === 'poor'
            ? 'poor'
            : acc.clsStatus === 'poor'
              ? 'poor'
              : (u.clsStatus ?? acc.clsStatus),
      inpStatus:
        acc.inpStatus === null
          ? u.inpStatus
          : u.inpStatus === 'poor'
            ? 'poor'
            : acc.inpStatus === 'poor'
              ? 'poor'
              : (u.inpStatus ?? acc.inpStatus),
    }),
    {
      lcp: null,
      fcp: null,
      cls: null,
      inp: null,
      lcpStatus: null,
      fcpStatus: null,
      clsStatus: null,
      inpStatus: null,
    },
  );

  return (
    <div className="mb-6">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">Core Web Vitals (P75)</h3>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CwvTile label="LCP" value={aggregate.lcp} unit="ms" status={aggregate.lcpStatus} />
        <CwvTile label="FCP" value={aggregate.fcp} unit="ms" status={aggregate.fcpStatus} />
        <CwvTile label="CLS" value={aggregate.cls} unit="" status={aggregate.clsStatus} />
        <CwvTile label="INP" value={aggregate.inp} unit="ms" status={aggregate.inpStatus} />
      </div>

      {cwv.trend.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-medium">CWV trend (avg per run)</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cwv.trend} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <XAxis
                  dataKey="startedAt"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={formatChartDate}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v) => `${v}ms`}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelFormatter={formatChartDate}
                  formatter={(v, name) => [`${v}ms`, String(name).toUpperCase()]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10 }}
                  formatter={(v) => String(v).toUpperCase()}
                />
                <Area
                  type="monotone"
                  dataKey="avgLcpMs"
                  name="lcp"
                  stroke="#60a5fa"
                  fill="#60a5fa20"
                  dot={false}
                  strokeWidth={2}
                  activeDot={{ r: 3 }}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="avgFcpMs"
                  name="fcp"
                  stroke="#4ade80"
                  fill="#4ade8020"
                  dot={false}
                  strokeWidth={2}
                  activeDot={{ r: 3 }}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="avgInpMs"
                  name="inp"
                  stroke="#fb923c"
                  fill="#fb923c20"
                  dot={false}
                  strokeWidth={2}
                  activeDot={{ r: 3 }}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <CwvUrlTrendCharts urlTrend={cwv.urlTrend} />
    </div>
  );
}

// ── SeoTab ────────────────────────────────────────────────────────────────────

export function SeoTab({ data, cwv }: { data: { urls: UrlSeoSummary[] }; cwv: GroupCwv | undefined }) {
  const issueCount = data.urls.reduce((n, u) => n + u.issues.length, 0);
  const changedCount = data.urls.filter((u) => u.changed).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        {issueCount > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span className="font-medium">
              {issueCount} SEO {issueCount === 1 ? 'issue' : 'issues'}
            </span>
            <span className="text-muted-foreground">
              across {data.urls.filter((u) => u.issues.length > 0).length} URLs
            </span>
          </div>
        )}
        {changedCount > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
            <span className="font-medium">
              {changedCount} {changedCount === 1 ? 'URL' : 'URLs'} changed
            </span>
            <span className="text-muted-foreground">since last run</span>
          </div>
        )}
        {data.urls.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No SEO data collected — visits may be failing. Check the Uptime tab for errors.
          </p>
        )}
      </div>

      {cwv && cwv.urls.length > 0 && <CwvSection cwv={cwv} />}

      <div className="flex flex-col gap-3">
        {data.urls.map((u) => {
          const urlCwv: UrlCwv | undefined = cwv?.urls.find((c) => c.url === u.url);
          return (
            <Card key={u.url}>
              {urlCwv && (
                <div className="border-b border-border px-4 pt-4 pb-3">
                  <p className="mb-2 text-xs text-muted-foreground font-medium">
                    Core Web Vitals (P75)
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    <CwvTile label="LCP" value={urlCwv.lcpP75} unit="ms" status={urlCwv.lcpStatus} />
                    <CwvTile label="FCP" value={urlCwv.fcpP75} unit="ms" status={urlCwv.fcpStatus} />
                    <CwvTile label="CLS" value={urlCwv.clsP75} unit="" status={urlCwv.clsStatus} />
                    <CwvTile label="INP" value={urlCwv.inpP75} unit="ms" status={urlCwv.inpStatus} />
                  </div>
                </div>
              )}

              <CardContent className="pt-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {u.changed && (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-yellow-500 text-yellow-600 dark:text-yellow-400 text-xs"
                      >
                        Changed
                      </Badge>
                    )}
                    <ExternalLink href={u.url} className="truncate font-mono text-xs text-muted-foreground">
                      {u.url}
                    </ExternalLink>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-lg font-bold ${scoreColor(u.score)}`}>{u.score}</span>
                    <span className="text-xs text-muted-foreground">/ 100</span>
                  </div>
                </div>

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

                {u.latestSeo && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors">
                      <span className="font-medium">SEO details</span>
                      <span className="text-xs">▼</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="rounded-b-md border border-t-0 border-border px-3 py-1">
                        <SeoFieldRow label="Title" value={u.latestSeo.title} />
                        <SeoFieldRow label="Meta description" value={u.latestSeo.metaDescription} />
                        <SeoFieldRow label="H1" value={u.latestSeo.h1} />
                        <SeoFieldRow label="H2" value={u.latestSeo.h2} />
                        <SeoFieldRow label="H3" value={u.latestSeo.h3} />
                        <SeoFieldRow label="H4" value={u.latestSeo.h4} />
                        <SeoFieldRow label="H5" value={u.latestSeo.h5} />
                        <SeoFieldRow label="Canonical URL" value={u.latestSeo.canonicalUrl} />
                        <SeoFieldRow label="og:title" value={u.latestSeo.ogTitle} />
                        <SeoFieldRow label="og:description" value={u.latestSeo.ogDescription} />
                        <SeoFieldRow label="og:image" value={u.latestSeo.ogImage} />
                        <SeoFieldRow label="Viewport" value={u.latestSeo.viewportMeta} />
                        <SeoFieldRow label="Lang" value={u.latestSeo.lang} />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {u.changed && u.history.length >= 2 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      Changes since previous run
                    </p>
                    <div className="space-y-1">
                      {(['title', 'metaDescription', 'h1', 'canonicalUrl'] as const).map((field) => {
                        const prev = u.history[1].seo[field];
                        const curr = u.history[0].seo[field];
                        if (prev === curr) return null;
                        const labels: Record<string, string> = {
                          title: 'Title',
                          metaDescription: 'Meta description',
                          h1: 'H1',
                          canonicalUrl: 'Canonical',
                        };
                        return (
                          <div
                            key={field}
                            className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs"
                          >
                            <span className="font-medium text-yellow-600 dark:text-yellow-400">
                              {labels[field]}
                            </span>
                            <div className="mt-1 text-muted-foreground line-through">
                              {prev ?? '(empty)'}
                            </div>
                            <div className="mt-0.5 text-foreground">{curr ?? '(empty)'}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
