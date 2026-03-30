import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Spinner } from '../components/Spinner';
import { StatusBadge } from '../components/StatusBadge';
import { cancelRun, getRunById } from '../lib/api';
import { formatDate, formatDuration, formatMs } from '../lib/formatters';
import { queryKeys } from '../lib/queryKeys';

export const Route = createFileRoute('/history_/$runId')({
  loader: ({ context: { queryClient }, params }) => {
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
      <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
        <Skeleton className="h-4 w-14" />
        <span>/</span>
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="mb-1.5 h-3 w-12" />
              <Skeleton className="h-5 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {['URL', 'Status', 'Redirects', 'TTFB', 'Load', 'Error'].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-64" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-8" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-12" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-12" />
                </TableCell>
                <TableCell />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
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

  if (!run) {
    return <p className="text-muted-foreground">Run not found.</p>;
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/history" search={{ page: 1, group: '' }} className="hover:text-foreground">
          History
        </Link>
        <span>/</span>
        <Link
          to="/groups/$groupName"
          params={{ groupName: run.group_name }}
          className="hover:text-foreground"
        >
          {run.group_name}
        </Link>
        <span>/</span>
        <span>Run #{run.id}</span>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Run #{run.id}</h1>
          <Link
            to="/groups/$groupName"
            params={{ groupName: run.group_name }}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            {run.group_name}
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={run.status} />
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

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Started" value={formatDate(run.started_at)} />
        <Metric label="Duration" value={formatDuration(run.started_at, run.ended_at)} />
        <Metric
          label="Success"
          value={run.success_count !== null ? String(run.success_count) : '…'}
        />
        <Metric
          label="Failed"
          value={run.failure_count !== null ? String(run.failure_count) : '…'}
        />
      </div>

      {run.visits.length === 0 ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          {run.status === 'running' && <Spinner className="h-4 w-4" />}
          <span className="text-sm">
            {run.status === 'running' ? 'Waiting for first visit…' : 'No visits recorded.'}
          </span>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Redirects</TableHead>
                <TableHead>TTFB</TableHead>
                <TableHead>Load</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.visits.map((visit) => (
                <TableRow key={visit.id} className={visit.error ? 'bg-destructive/10' : ''}>
                  <TableCell className="max-w-xs truncate font-mono text-xs">
                    <a
                      href={visit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground hover:underline"
                    >
                      {visit.url}
                    </a>
                  </TableCell>
                  <TableCell>{visit.status_code ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {visit.redirect_count > 0 ? visit.redirect_count : '—'}
                  </TableCell>
                  <TableCell>{formatMs(visit.ttfb_ms)}</TableCell>
                  <TableCell>{formatMs(visit.load_time_ms)}</TableCell>
                  <TableCell className="text-xs text-destructive">{visit.error ?? ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-medium">{value}</p>
      </CardContent>
    </Card>
  );
}
