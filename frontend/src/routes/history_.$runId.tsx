import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { createColumnHelper } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ExternalLink } from '../components/ExternalLink';
import { Spinner } from '../components/Spinner';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { cancelRun, getApiKey, getRunById } from '../lib/api';
import { formatDate, formatDuration, formatMs } from '../lib/formatters';
import { queryKeys } from '../lib/queryKeys';
import type { Visit } from '../lib/types';

const columnHelper = createColumnHelper<Visit>();

const columns = [
  columnHelper.accessor('url', {
    header: 'URL',
    cell: (info) => (
      <ExternalLink href={info.getValue()} className="font-mono text-xs">
        {info.getValue()}
      </ExternalLink>
    ),
  }),
  columnHelper.accessor('status_code', {
    header: 'Status',
    cell: (info) => info.getValue() ?? '—',
  }),
  columnHelper.accessor('redirect_count', {
    header: 'Redirects',
    cell: (info) => (
      <span className="text-muted-foreground">{info.getValue() > 0 ? info.getValue() : '—'}</span>
    ),
  }),
  columnHelper.accessor('ttfb_ms', {
    header: 'TTFB',
    cell: (info) => formatMs(info.getValue()),
  }),
  columnHelper.accessor('load_time_ms', {
    header: 'Load',
    cell: (info) => formatMs(info.getValue()),
  }),
  columnHelper.accessor('retry_count', {
    header: 'Retries',
    cell: (info) => (
      <span className="text-muted-foreground">{info.getValue() > 0 ? info.getValue() : '—'}</span>
    ),
  }),
  columnHelper.accessor('error', {
    header: 'Error',
    cell: (info) => <span className="text-xs text-destructive">{info.getValue() ?? ''}</span>,
  }),
];

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
            {[0, 1, 2, 3, 4, 5].map((i) => (
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
          search={{ tab: 'overview' }}
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
            search={{ tab: 'overview' }}
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
        <StatCard label="Started" value={formatDate(run.started_at)} />
        <StatCard label="Duration" value={formatDuration(run.started_at, run.ended_at)} />
        <StatCard
          label="Success"
          value={run.success_count !== null ? String(run.success_count) : '…'}
        />
        <StatCard
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
        <DataTable
          columns={columns}
          data={run.visits}
          searchPlaceholder="Search URLs…"
          defaultSorting={[{ id: 'load_time_ms', desc: true }]}
          getRowClassName={(v) => (v.error ? 'bg-destructive/10' : '')}
        />
      )}
    </div>
  );
}
