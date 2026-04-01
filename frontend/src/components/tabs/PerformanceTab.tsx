import { Area, AreaChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
import { formatMs } from '@/lib/formatters';
import type { GroupPerformance } from '@/lib/types';
import { ExternalLink } from '../ExternalLink';

export function PerformanceTab({ data }: { data: GroupPerformance }) {
  if (data.urls.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No performance data yet — run the group to start collecting data.
      </p>
    );
  }

  const slowCount = data.urls.filter((u) => u.isSlow).length;

  const urlList = [...new Set(data.loadTimeTrend.map((p) => p.url))].slice(0, 6);
  const byRun = new Map<string, Record<string, string | number>>();
  for (const p of data.loadTimeTrend) {
    let row = byRun.get(p.startedAt);
    if (!row) {
      row = { startedAt: p.startedAt };
      byRun.set(p.startedAt, row);
    }
    row[p.url] = p.avgLoadTimeMs;
  }
  const chartData = [...byRun.values()];

  return (
    <div>
      {slowCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span className="font-medium">
            {slowCount} slow {slowCount === 1 ? 'page' : 'pages'}
          </span>
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

      {chartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-medium">Load time trend per URL</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
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
                {urlList.map((url, i) => (
                  <Area
                    key={url}
                    type="monotone"
                    dataKey={url}
                    stroke={getColor(i)}
                    fill={getColor(i)}
                    fillOpacity={0.08}
                    dot={false}
                    strokeWidth={2}
                    activeDot={{ r: 3 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
