import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRunById, cancelRun } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { StatusBadge } from '../components/StatusBadge';
import { Spinner } from '../components/Spinner';
import { formatDate, formatDuration, formatMs } from '../lib/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const Route = createFileRoute('/history_/$runId')({
  component: RunDetailPage,
});

function RunDetailPage() {
  const { runId } = Route.useParams();
  const id = parseInt(runId);
  const queryClient = useQueryClient();

  const { data: run, isLoading } = useQuery({
    queryKey: queryKeys.runs.detail(id),
    queryFn: () => getRunById(id),
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 2000 : false),
  });

  const cancel = useMutation({
    mutationFn: () => cancelRun(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.runs.detail(id) }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="text-muted-foreground" />
      </div>
    );
  }

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
        <span>Run #{run.id}</span>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Run #{run.id}</h1>
          <p className="text-sm text-muted-foreground">{run.group_name}</p>
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
        <Metric label="Success" value={run.success_count !== null ? String(run.success_count) : '…'} />
        <Metric label="Failed" value={run.failure_count !== null ? String(run.failure_count) : '…'} />
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
                <TableHead>TTFB</TableHead>
                <TableHead>Load</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.visits.map((visit) => (
                <TableRow
                  key={visit.id}
                  className={visit.error ? 'bg-destructive/10' : ''}
                >
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
