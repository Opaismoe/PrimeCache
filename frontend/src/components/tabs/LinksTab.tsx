import { createColumnHelper } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { TooltipContent, TooltipTrigger, Tooltip as UiTooltip } from '@/components/ui/tooltip';
import { formatDate } from '@/lib/formatters';
import { HTTP_STATUS_CODES } from '@/lib/httpStatusCodes';
import type { BrokenLinkSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ExternalLink } from '../ExternalLink';

function HttpStatusBadge({ status }: { status: number | null }) {
  if (status === null) return <span className="text-muted-foreground text-xs">—</span>;

  const info = HTTP_STATUS_CODES[status];
  const badge = (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono font-medium cursor-default',
        status < 300
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
          : status < 400
            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      )}
    >
      {status}
    </span>
  );

  if (!info) return badge;

  return (
    <UiTooltip>
      <TooltipTrigger render={badge} />
      <TooltipContent className="max-w-xs" side="top">
        <p className="font-semibold">
          {status} {info.name}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{info.description}</p>
        <ExternalLink href={info.mdnUrl} className="mt-1 block text-xs text-blue-400">
          Learn more on MDN →
        </ExternalLink>
      </TooltipContent>
    </UiTooltip>
  );
}

const columnHelper = createColumnHelper<BrokenLinkSummary>();

const columns = [
  columnHelper.accessor('url', {
    header: 'URL',
    cell: (info) => (
      <ExternalLink href={info.getValue()} className="font-mono text-xs text-muted-foreground">
        {info.getValue()}
      </ExternalLink>
    ),
  }),
  columnHelper.accessor('statusCode', {
    header: 'Status',
    cell: (info) => <HttpStatusBadge status={info.getValue()} />,
  }),
  columnHelper.accessor('error', {
    header: 'Error',
    cell: (info) => (
      <span className="max-w-[200px] truncate text-xs text-muted-foreground">
        {info.getValue() ?? '—'}
      </span>
    ),
  }),
  columnHelper.accessor('occurrences', {
    header: 'Occurrences',
    cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
  }),
  columnHelper.accessor('lastSeenAt', {
    header: 'Last seen',
    cell: (info) => (
      <span className="text-xs text-muted-foreground">{formatDate(info.getValue())}</span>
    ),
  }),
];

export function LinksTab({ data }: { data: BrokenLinkSummary[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No broken links found — all discovered links returned 2xx/3xx responses.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <span className="font-medium">
          {data.length} broken {data.length === 1 ? 'link' : 'links'} detected
        </span>
      </div>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search URLs…"
        defaultSorting={[{ id: 'occurrences', desc: true }]}
      />
    </div>
  );
}
