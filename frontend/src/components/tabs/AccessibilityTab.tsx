import { createColumnHelper } from '@tanstack/react-table';
import { useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { GroupAccessibility, UrlAccessibilitySummary } from '@/lib/types';
import { ExternalLink } from '../ExternalLink';
import { AccessibilityDetailModal } from './AccessibilityDetailModal';

const IMPACT_COLORS: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  serious: 'bg-orange-500 text-white',
  moderate: 'bg-yellow-500 text-black',
  minor: 'bg-muted text-muted-foreground',
};

const columnHelper = createColumnHelper<UrlAccessibilitySummary>();

const columns = [
  columnHelper.accessor('url', {
    header: 'URL',
    cell: (info) => (
      <ExternalLink
        href={info.getValue()}
        className="font-mono text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {info.getValue()}
      </ExternalLink>
    ),
  }),
  columnHelper.accessor('latestCriticalCount', {
    header: 'Critical',
    cell: (info) =>
      info.getValue() > 0 ? (
        <span className="font-semibold text-destructive">{info.getValue()}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  }),
  columnHelper.accessor('latestSeriousCount', {
    header: 'Serious',
    cell: (info) =>
      info.getValue() > 0 ? (
        <span className="font-semibold text-orange-500">{info.getValue()}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  }),
  columnHelper.accessor('latestViolationCount', {
    header: 'Total',
    cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
  }),
  columnHelper.accessor('topViolations', {
    header: 'Top violations',
    enableSorting: false,
    cell: (info) => (
      <div className="flex flex-wrap gap-1">
        {info.getValue().map((v) => (
          <ExternalLink
            key={v.id}
            href={v.helpUrl}
            title={v.help}
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${IMPACT_COLORS[v.impact] ?? IMPACT_COLORS.minor} hover:opacity-80`}
          >
            {v.id}
            {v.occurrences > 1 && <span className="opacity-70">×{v.occurrences}</span>}
          </ExternalLink>
        ))}
      </div>
    ),
  }),
];

export function AccessibilityTab({ data }: { data: GroupAccessibility }) {
  const [selectedUrl, setSelectedUrl] = useState<UrlAccessibilitySummary | null>(null);

  const totalCritical = data.urls.reduce((s, u) => s + u.latestCriticalCount, 0);
  const totalSerious = data.urls.reduce((s, u) => s + u.latestSeriousCount, 0);

  const bannerClass =
    totalCritical > 0
      ? 'border-destructive bg-destructive/10 text-destructive'
      : totalSerious > 0
        ? 'border-orange-400 bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
        : 'border-border bg-muted/30 text-muted-foreground';

  return (
    <>
      <AccessibilityDetailModal urlData={selectedUrl} onClose={() => setSelectedUrl(null)} />
      <div className="space-y-4">
        <div className={`rounded-lg border p-4 text-sm font-medium ${bannerClass}`}>
          {totalCritical > 0 || totalSerious > 0
            ? `${totalCritical} critical, ${totalSerious} serious violations across ${data.urls.length} URL${data.urls.length !== 1 ? 's' : ''}`
            : `No critical or serious violations across ${data.urls.length} URL${data.urls.length !== 1 ? 's' : ''}`}
        </div>

        <DataTable
          columns={columns}
          data={data.urls}
          searchPlaceholder="Search URLs…"
          defaultSorting={[
            { id: 'latestCriticalCount', desc: true },
            { id: 'latestSeriousCount', desc: true },
          ]}
          onRowClick={setSelectedUrl}
        />
      </div>
    </>
  );
}
