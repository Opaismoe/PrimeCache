import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { createColumnHelper } from '@tanstack/react-table';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { getRuns } from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';
import type { Run } from '@/lib/types';
import { RunResults } from '../RunResults';
import { StatusBadge } from '../StatusBadge';

const PAGE_SIZE = 20;

const columnHelper = createColumnHelper<Run>();
const columns = [
  columnHelper.accessor('id', {
    header: 'Run #',
    cell: (info) => <span className="text-muted-foreground">#{info.getValue()}</span>,
  }),
  columnHelper.accessor('started_at', {
    header: 'Started',
    cell: (info) => formatDate(info.getValue()),
  }),
  columnHelper.display({
    id: 'duration',
    header: 'Duration',
    enableSorting: false,
    cell: (info) => formatDuration(info.row.original.started_at, info.row.original.ended_at),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    enableSorting: false,
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  columnHelper.display({
    id: 'results',
    header: 'Results',
    enableSorting: false,
    cell: (info) => (
      <RunResults
        successCount={info.row.original.success_count}
        failureCount={info.row.original.failure_count}
      />
    ),
  }),
];

interface HistoryTabProps {
  groupName: string;
  /** Controls whether the data query is active (mirrors `enabled` on the hook). */
  isActive: boolean;
}

export function HistoryTab({ groupName, isActive }: HistoryTabProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  const { data: runs, isLoading } = useQuery({
    queryKey: [...queryKeys.runs.all(), 'group-tab', groupName, page],
    queryFn: () => getRuns({ group: groupName, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    enabled: isActive,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (!runs?.length && page === 0) {
    return <p className="text-sm text-muted-foreground">No runs found for this group.</p>;
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={runs ?? []}
        searchPlaceholder="Search runs…"
        defaultSorting={[{ id: 'started_at', desc: true }]}
        defaultPageSize={PAGE_SIZE}
        onRowClick={(run) => navigate({ to: '/history/$runId', params: { runId: String(run.id) } })}
      />
      <div className="mt-4 flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => p - 1)}
          disabled={page <= 0}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">Page {page + 1}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => p + 1)}
          disabled={(runs?.length ?? 0) < PAGE_SIZE}
        >
          Next
        </Button>
      </div>
    </>
  );
}
