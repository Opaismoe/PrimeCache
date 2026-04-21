import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink } from '../components/ExternalLink';
import { Spinner } from '../components/Spinner';
import { StatusBadge } from '../components/StatusBadge';
import { cancelRun, getApiKey, getRunById } from '../lib/api';
import { formatDate, formatDuration, formatMs } from '../lib/formatters';
import { queryKeys } from '../lib/queryKeys';
import type { Visit } from '../lib/types';

export const Route = createFileRoute('/history_/$runId')({
  loader: ({ context: { queryClient }, params }) => {
    if (!getApiKey()) return;
    const id = parseInt(params.runId, 10);
    return queryClient.ensureQueryData(
      queryOptions({
        queryKey: queryKeys.runs.detail(id),
        queryFn: () => getRunById(id),
      }),
    );
  },
  pendingComponent: RunDetailSkeleton,
  pendingMs: 200,
  pendingMinMs: 300,
  component: RunDetailPage,
});

function RunDetailSkeleton() {
  return (
    <div>
      <Skeleton className="mb-4 h-4 w-48" />
      <Skeleton className="mb-2 h-8 w-36" />
      <Skeleton className="mb-8 h-4 w-64" />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[72px] rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[300px] w-full rounded-lg" />
    </div>
  );
}

function RunDetailPage() {
  const { runId } = Route.useParams();
  const id = parseInt(runId, 10);
  const queryClient = useQueryClient();

  const { data: run } = useQuery({
    queryKey: queryKeys.runs.detail(id),
    queryFn: () => getRunById(id),
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 2000 : false),
  });

  const cancel = useMutation({
    mutationFn: () => cancelRun(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.runs.detail(id) }),
  });

  if (!run) return <p className="text-muted-foreground">Run not found.</p>;

  const visits = run.visits;
  const successCount = run.success_count ?? visits.filter((v) => !v.error).length;
  const totalCount = run.total_urls ?? visits.length;
  const successPct = totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(0) : '—';
  const avgLoad =
    visits.length > 0
      ? Math.round(visits.reduce((s, v) => s + v.load_time_ms, 0) / visits.length)
      : null;
  const validTtfb = visits.filter((v) => v.ttfb_ms != null);
  const avgTtfb =
    validTtfb.length > 0
      ? Math.round(validTtfb.reduce((s, v) => s + (v.ttfb_ms ?? 0), 0) / validTtfb.length)
      : null;

  // Build waterfall data — sort by load_time desc, limit to 24
  const waterfallVisits = [...visits].sort((a, b) => b.load_time_ms - a.load_time_ms).slice(0, 24);
  const maxLoad = Math.max(...waterfallVisits.map((v) => v.load_time_ms), 1);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/history" search={{ page: 1, group: '' }} className="hover:text-foreground">
          History
        </Link>
        <span>/</span>
        <Link
          to="/groups/$groupName"
          params={{ groupName: run.group_name }}
          search={{ tab: 'health', qtab: 'seo' }}
          className="hover:text-foreground"
        >
          {run.group_name}
        </Link>
        <span>/</span>
        <span>Run #{run.id}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={run.status} />
            <span className="font-mono rounded-md border border-border bg-muted px-2 py-0.5 text-xs">
              {formatDate(run.started_at)}
            </span>
            <span className="font-mono rounded-md border border-border bg-muted px-2 py-0.5 text-xs">
              {formatDuration(run.started_at, run.ended_at)}
            </span>
          </div>
          <h1 className="text-2xl font-semibold">
            Run <span className="font-mono">#{run.id}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {run.group_name} · {totalCount} URL{totalCount !== 1 ? 's' : ''}
            {run.failure_count ? ` · ${run.failure_count} failed` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {run.status === 'running' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => cancel.mutate()}
              disabled={cancel.isPending}
            >
              {cancel.isPending ? 'Stopping…' : 'Stop'}
            </Button>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <MiniKpi label="URLs" value={String(totalCount)} />
        <MiniKpi
          label="Success"
          value={`${successPct}%`}
          tone={Number(successPct) === 100 ? 'ok' : Number(successPct) >= 80 ? 'warn' : 'bad'}
        />
        <MiniKpi label="Avg load" value={avgLoad != null ? formatMs(avgLoad) : '—'} />
        <MiniKpi label="Avg TTFB" value={avgTtfb != null ? formatMs(avgTtfb) : '—'} />
        <MiniKpi
          label="Failed"
          value={String(run.failure_count ?? 0)}
          tone={run.failure_count ? 'bad' : 'ok'}
        />
      </div>

      {/* Waterfall */}
      {waterfallVisits.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium">Request waterfall</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {waterfallVisits.length} of {visits.length} URLs · sorted by load time · blue =
                  TTFB · amber = content
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-3 rounded-sm bg-sky-500/70" />
                  TTFB
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-3 rounded-sm bg-amber-500/80" />
                  Content
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_48px_56px_1fr] gap-2 border-b border-border px-4 py-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              <div>URL</div>
              <div>Status</div>
              <div>Load</div>
              <div>Timeline</div>
            </div>
            <div className="divide-y divide-border">
              {waterfallVisits.map((v) => (
                <WaterfallRow key={v.id} visit={v} maxLoad={maxLoad} />
              ))}
            </div>
            {visits.length > 24 && (
              <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                Showing 24 of {visits.length} URLs
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Visit table */}
      {visits.length === 0 ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          {run.status === 'running' && <Spinner className="h-4 w-4" />}
          <span className="text-sm">
            {run.status === 'running' ? 'Waiting for first visit…' : 'No visits recorded.'}
          </span>
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-sm font-medium">All visits</h2>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="grid grid-cols-[1fr_52px_56px_72px_72px_56px] gap-2 border-b border-border px-4 py-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              <div>URL</div>
              <div>Status</div>
              <div>TTFB</div>
              <div>Load</div>
              <div>Retries</div>
              <div>Redirects</div>
            </div>
            <div className="divide-y divide-border">
              {visits.map((v) => (
                <VisitRow key={v.id} visit={v} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MiniKpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'bad';
}) {
  const cls =
    tone === 'ok'
      ? 'text-green-500'
      : tone === 'warn'
        ? 'text-amber-500'
        : tone === 'bad'
          ? 'text-destructive'
          : '';
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-3">
      <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className={`font-mono text-xl font-semibold tabular-nums ${cls}`}>{value}</span>
    </div>
  );
}

function WaterfallRow({ visit, maxLoad }: { visit: Visit; maxLoad: number }) {
  const ttfbW = visit.ttfb_ms != null ? (visit.ttfb_ms / maxLoad) * 100 : 0;
  const contentW =
    visit.ttfb_ms != null
      ? Math.max(0, ((visit.load_time_ms - visit.ttfb_ms) / maxLoad) * 100)
      : (visit.load_time_ms / maxLoad) * 100;
  const hasError = !!visit.error;
  const statusOk = visit.status_code != null && visit.status_code < 400;

  return (
    <div
      className={`grid grid-cols-[1fr_48px_56px_1fr] items-center gap-2 px-4 py-2 text-xs ${
        hasError ? 'bg-destructive/5' : ''
      }`}
    >
      <div className="min-w-0">
        <ExternalLink
          href={visit.final_url ?? visit.url}
          className={`block truncate font-mono text-[11px] ${hasError ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {visit.url}
        </ExternalLink>
        {visit.error && (
          <span className="block truncate text-[10px] text-destructive">{visit.error}</span>
        )}
      </div>
      <div className={`font-mono text-xs ${statusOk ? 'text-green-500' : 'text-destructive'}`}>
        {visit.status_code ?? '—'}
      </div>
      <div className="font-mono text-xs text-muted-foreground">{formatMs(visit.load_time_ms)}</div>
      <div className="flex h-3 items-center gap-0.5 overflow-hidden rounded-sm bg-muted/30">
        {ttfbW > 0 && (
          <div
            className="h-full rounded-l-sm bg-sky-500/70"
            style={{ width: `${ttfbW}%`, minWidth: 2 }}
          />
        )}
        {contentW > 0 && (
          <div
            className="h-full rounded-r-sm bg-amber-500/80"
            style={{ width: `${contentW}%`, minWidth: 2 }}
          />
        )}
      </div>
    </div>
  );
}

function VisitRow({ visit }: { visit: Visit }) {
  const hasError = !!visit.error;
  const statusOk = visit.status_code != null && visit.status_code < 400;
  return (
    <div
      className={`grid grid-cols-[1fr_52px_56px_72px_72px_56px] items-center gap-2 px-4 py-2.5 text-xs ${
        hasError ? 'bg-destructive/5' : ''
      }`}
    >
      <div className="min-w-0">
        <ExternalLink
          href={visit.final_url ?? visit.url}
          className="block truncate font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          {visit.url}
        </ExternalLink>
        {visit.error && (
          <span className="block truncate text-[10px] text-destructive">{visit.error}</span>
        )}
      </div>
      <div className={`font-mono ${statusOk ? '' : 'text-destructive'}`}>
        {visit.status_code ?? '—'}
      </div>
      <div className="font-mono text-muted-foreground">{formatMs(visit.ttfb_ms)}</div>
      <div className="font-mono">{formatMs(visit.load_time_ms)}</div>
      <div className="font-mono text-muted-foreground">{visit.retry_count || '—'}</div>
      <div className="font-mono text-muted-foreground">{visit.redirect_count || '—'}</div>
    </div>
  );
}
