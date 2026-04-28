import { createColumnHelper } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { formatMs } from '@/lib/formatters';
import type { GroupPerformance, UrlPerformance } from '@/lib/types';
import { ExternalLink } from '../ExternalLink';
import { Sparkline } from '../Sparkline';

const columnHelper = createColumnHelper<UrlPerformance>();

function buildTrendMap(loadTimeTrend: GroupPerformance['loadTimeTrend']): Map<string, number[]> {
  const map = new Map<string, { startedAt: string; value: number }[]>();
  for (const p of loadTimeTrend) {
    if (!map.has(p.url)) map.set(p.url, []);
    map.get(p.url)?.push({ startedAt: p.startedAt, value: p.avgLoadTimeMs });
  }
  const result = new Map<string, number[]>();
  for (const [url, points] of map) {
    result.set(
      url,
      points.sort((a, b) => a.startedAt.localeCompare(b.startedAt)).map((p) => p.value),
    );
  }
  return result;
}

function makeColumns(trendByUrl: Map<string, number[]>) {
  return [
    columnHelper.accessor('url', {
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
    columnHelper.accessor('p50LoadTimeMs', {
      header: 'P50 Load',
      cell: (info) => formatMs(info.getValue()),
    }),
    columnHelper.accessor('p95LoadTimeMs', {
      header: 'P95 Load',
      cell: (info) => (
        <span className={info.row.original.isSlow ? 'font-medium text-destructive' : ''}>
          {formatMs(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor('p50TtfbMs', {
      header: 'P50 TTFB',
      cell: (info) => (info.getValue() != null ? formatMs(info.getValue()) : '—'),
    }),
    columnHelper.accessor('p95TtfbMs', {
      header: 'P95 TTFB',
      cell: (info) => (info.getValue() != null ? formatMs(info.getValue()) : '—'),
    }),
    columnHelper.accessor('sampleCount', {
      header: 'Samples',
      cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
    }),
    columnHelper.display({
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

export function PerformanceTab({ data }: { data: GroupPerformance }) {
  if (data.urls.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No performance data yet — run the group to start collecting data.
      </p>
    );
  }

  const slowCount = data.urls.filter((u) => u.isSlow).length;
  const trendByUrl = buildTrendMap(data.loadTimeTrend);
  const columns = makeColumns(trendByUrl);

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

      <DataTable
        columns={columns}
        data={data.urls}
        searchPlaceholder="Search URLs…"
        defaultSorting={[{ id: 'p95LoadTimeMs', desc: true }]}
      />
    </div>
  );
}
