import { createColumnHelper } from '@tanstack/react-table';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { formatChartDate } from '@/lib/formatChartDate';
import { formatDate } from '@/lib/formatters';
import type { GroupUptime, UrlUptime } from '@/lib/types';
import { ExternalLink } from '../ExternalLink';

const columnHelper = createColumnHelper<UrlUptime>();

const columns = [
  columnHelper.accessor('url', {
    header: 'URL',
    cell: (info) => (
      <ExternalLink href={info.getValue()} className="truncate font-mono text-xs">
        {info.getValue()}
      </ExternalLink>
    ),
  }),
  columnHelper.accessor('uptimePct', {
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
  columnHelper.accessor('downCount', {
    header: 'Down',
    cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
  }),
  columnHelper.accessor('totalChecks', {
    header: 'Checks',
    cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
  }),
  columnHelper.accessor('lastStatus', {
    header: 'Last status',
    cell: (info) => (
      <Badge variant={info.getValue() === 'up' ? 'default' : 'destructive'} className="text-xs">
        {info.getValue() === 'up' ? 'Up' : 'Down'}
      </Badge>
    ),
  }),
  columnHelper.accessor('lastCheckedAt', {
    header: 'Last checked',
    cell: (info) => (
      <span className="text-xs text-muted-foreground">{formatDate(info.getValue())}</span>
    ),
  }),
];

export function UptimeTab({ data }: { data: GroupUptime }) {
  if (data.urls.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No uptime data yet — run the group to start collecting data.
      </p>
    );
  }

  const downNow = data.urls.filter((u) => u.lastStatus === 'down').length;

  const byUrl = new Map<string, { startedAt: string; value: number }[]>();
  for (const pt of data.uptimeTrend) {
    const arr = byUrl.get(pt.url) ?? [];
    arr.push({ startedAt: pt.startedAt, value: pt.wasDown ? 0 : 1 });
    byUrl.set(pt.url, arr);
  }
  const urlEntries = [...byUrl.entries()];

  return (
    <div>
      {downNow > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span className="font-medium">
            {downNow} {downNow === 1 ? 'URL' : 'URLs'} currently down
          </span>
        </div>
      )}

      <div className="mb-6">
        <DataTable
          columns={columns}
          data={data.urls}
          searchPlaceholder="Search URLs…"
          defaultSorting={[{ id: 'uptimePct', desc: false }]}
        />
      </div>

      {urlEntries.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col divide-y divide-border">
              {urlEntries.map(([url, points]) => {
                const label = (() => {
                  try {
                    return new URL(url).pathname || '/';
                  } catch {
                    return url;
                  }
                })();
                const hasOutage = points.some((p) => p.value === 0);
                return (
                  <div key={url} className="flex items-center gap-3 py-2">
                    <span
                      className="w-56 shrink-0 truncate text-xs font-mono text-muted-foreground"
                      title={url}
                    >
                      {label}
                    </span>
                    {hasOutage ? (
                      <span className="text-xs text-destructive shrink-0">⚠ outage</span>
                    ) : (
                      <span className="text-xs text-green-500 shrink-0">✓ all up</span>
                    )}
                    <ResponsiveContainer width="100%" height={36}>
                      <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient
                            id={`upGrad-${url.replace(/[^a-z0-9]/gi, '')}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="5%" stopColor="#4ade80" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#4ade80" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="startedAt" hide />
                        <YAxis domain={[0, 1]} hide />
                        <Tooltip
                          contentStyle={{
                            background: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                            fontSize: 11,
                          }}
                          labelFormatter={formatChartDate}
                          formatter={(v) => [v === 1 ? 'Up' : 'Down', '']}
                        />
                        <Area
                          type="stepAfter"
                          dataKey="value"
                          stroke={hasOutage ? '#f87171' : '#4ade80'}
                          fill={`url(#upGrad-${url.replace(/[^a-z0-9]/gi, '')})`}
                          strokeWidth={1.5}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
