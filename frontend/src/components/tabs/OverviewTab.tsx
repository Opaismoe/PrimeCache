import { useNavigate } from '@tanstack/react-router';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import { RunResults } from '../RunResults';
import { StatusBadge } from '../StatusBadge';
import type { GroupOverview, Run } from '@/lib/types';

export function OverviewTab({ overview }: { overview: GroupOverview | undefined }) {
  const navigate = useNavigate();
  if (!overview) return null;

  const { recentRuns, series } = overview;
  const hasSeoData = series.some((s) => s.avgSeoScore !== null);

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-medium">Success rate per run</h3>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <XAxis
                    dataKey="startedAt"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={formatChartDate}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelFormatter={formatChartDate}
                    formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Success rate']}
                  />
                  <Area
                    type="monotone"
                    dataKey="successRate"
                    stroke="#4ade80"
                    fill="#4ade8020"
                    dot={false}
                    strokeWidth={2}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-medium">Avg load time per run</h3>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
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
                    formatter={(v) => [formatMs(Number(v)), 'Avg load']}
                  />
                  <Area
                    type="monotone"
                    dataKey="avgLoadTimeMs"
                    stroke="#60a5fa"
                    fill="#60a5fa20"
                    dot={false}
                    strokeWidth={2}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-medium">Uptime per run</h3>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <XAxis
                    dataKey="startedAt"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={formatChartDate}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelFormatter={formatChartDate}
                    formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Uptime']}
                  />
                  <Area
                    type="monotone"
                    dataKey="uptimePct"
                    stroke="#a78bfa"
                    fill="#a78bfa20"
                    dot={false}
                    strokeWidth={2}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {hasSeoData && (
            <Card>
              <CardHeader className="pb-2">
                <h3 className="text-sm font-medium">SEO score per run</h3>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <XAxis
                      dataKey="startedAt"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={formatChartDate}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelFormatter={formatChartDate}
                      formatter={(v) => [Number(v).toFixed(1), 'SEO score']}
                    />
                    <Area
                      type="monotone"
                      dataKey="avgSeoScore"
                      stroke="#fb923c"
                      fill="#fb923c20"
                      dot={false}
                      strokeWidth={2}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

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
                  className="cursor-pointer"
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
                    <RunResults successCount={run.success_count} failureCount={run.failure_count} />
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
