import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { GroupAccessibility } from '@/lib/types';
import { ExternalLink } from '../ExternalLink';

const IMPACT_COLORS: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  serious: 'bg-orange-500 text-white',
  moderate: 'bg-yellow-500 text-black',
  minor: 'bg-muted text-muted-foreground',
};

export function AccessibilityTab({ data }: { data: GroupAccessibility }) {
  const totalCritical = data.urls.reduce((s, u) => s + u.latestCriticalCount, 0);
  const totalSerious = data.urls.reduce((s, u) => s + u.latestSeriousCount, 0);

  const bannerClass =
    totalCritical > 0
      ? 'border-destructive bg-destructive/10 text-destructive'
      : totalSerious > 0
        ? 'border-orange-400 bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
        : 'border-border bg-muted/30 text-muted-foreground';

  const sorted = [...data.urls].sort(
    (a, b) =>
      b.latestCriticalCount - a.latestCriticalCount || b.latestSeriousCount - a.latestSeriousCount,
  );

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border p-4 text-sm font-medium ${bannerClass}`}>
        {totalCritical > 0 || totalSerious > 0
          ? `${totalCritical} critical, ${totalSerious} serious violations across ${data.urls.length} URL${data.urls.length !== 1 ? 's' : ''}`
          : `No critical or serious violations across ${data.urls.length} URL${data.urls.length !== 1 ? 's' : ''}`}
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>URL</TableHead>
              <TableHead>Critical</TableHead>
              <TableHead>Serious</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Top violations</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((url) => (
              <TableRow key={url.url}>
                <TableCell className="max-w-xs truncate font-mono text-xs">
                  <ExternalLink href={url.url}>{url.url}</ExternalLink>
                </TableCell>
                <TableCell>
                  {url.latestCriticalCount > 0 ? (
                    <span className="font-semibold text-destructive">
                      {url.latestCriticalCount}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {url.latestSeriousCount > 0 ? (
                    <span className="font-semibold text-orange-500">{url.latestSeriousCount}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{url.latestViolationCount}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {url.topViolations.map((v) => (
                      <ExternalLink
                        key={v.id}
                        href={v.helpUrl}
                        title={v.help}
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${IMPACT_COLORS[v.impact] ?? IMPACT_COLORS.minor} hover:opacity-80`}
                      >
                        {v.id}
                        {v.occurrences > 1 && <span className="opacity-70">×{v.occurrences}</span>}
                      </ExternalLink>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
