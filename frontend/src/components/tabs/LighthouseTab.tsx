import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { LighthouseUrlSummary } from '@/lib/types';
import { triggerGroupLighthouse } from '../../lib/api';
import { formatDate, formatMs } from '../../lib/formatters';
import { queryKeys } from '../../lib/queryKeys';
import { ExternalLink } from '../ExternalLink';

function ScoreCircle({ label, score }: { label: string; score: number | null }) {
  const color =
    score == null
      ? 'text-muted-foreground'
      : score >= 90
        ? 'text-green-500'
        : score >= 50
          ? 'text-yellow-500'
          : 'text-destructive';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{score ?? '—'}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

interface Props {
  data: LighthouseUrlSummary[];
  groupName: string;
}

export function LighthouseTab({ data, groupName }: Props) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);

  const trigger = useMutation({
    mutationFn: () => triggerGroupLighthouse(groupName),
    onSuccess: () => {
      setRunning(true);
      setTimeout(() => {
        setRunning(false);
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.lighthouse(groupName) });
      }, 60_000);
    },
  });

  const hasData = data.length > 0 && data.some((d) => d.latestReport !== null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        {!hasData && (
          <p className="text-sm text-muted-foreground">
            No Lighthouse audits yet. Run an audit to see scores. Enable{' '}
            <code>checkLighthouse</code> in Settings or trigger one manually.
          </p>
        )}
        {hasData && <div />}
        <Button
          onClick={() => trigger.mutate()}
          disabled={running || trigger.isPending}
          size="sm"
          variant="outline"
        >
          {running || trigger.isPending ? 'Running audit…' : 'Run audit'}
        </Button>
      </div>

      {hasData && (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {data.map((item) => {
            const report = item.latestReport;
            return (
              <Card key={item.url}>
                <CardContent className="pt-4 space-y-4">
                  {/* URL header */}
                  <div className="flex items-start justify-between gap-2">
                    <ExternalLink
                      href={item.url}
                      className="font-mono text-xs truncate text-muted-foreground max-w-xs"
                    >
                      {item.url}
                    </ExternalLink>
                    {report && (
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                            report.triggeredBy === 'manual'
                              ? 'bg-blue-500/10 text-blue-500'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {report.triggeredBy}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(report.auditedAt)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* No report yet */}
                  {!report && (
                    <p className="text-xs text-muted-foreground">No audit yet for this URL.</p>
                  )}

                  {/* Failed audit */}
                  {report?.failed && (
                    <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {report.error ?? 'Audit failed'}
                    </div>
                  )}

                  {/* Scores */}
                  {report && !report.failed && (
                    <>
                      <div className="grid grid-cols-4 gap-2">
                        <ScoreCircle label="Performance" score={report.performanceScore} />
                        <ScoreCircle label="Accessibility" score={report.accessibilityScore} />
                        <ScoreCircle label="SEO" score={report.seoScore} />
                        <ScoreCircle label="Best Practices" score={report.bestPracticesScore} />
                      </div>

                      {/* Key metrics */}
                      <div className="grid grid-cols-3 gap-x-4 gap-y-2 border-t border-border pt-3">
                        <div>
                          <p className="text-xs text-muted-foreground">LCP</p>
                          <p className="text-sm font-medium">{formatMs(report.lcpMs)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">FCP</p>
                          <p className="text-sm font-medium">{formatMs(report.fcpMs)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">CLS</p>
                          <p className="text-sm font-medium">
                            {report.clsScore != null ? report.clsScore.toFixed(3) : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">TBT</p>
                          <p className="text-sm font-medium">{formatMs(report.tbtMs)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Speed Index</p>
                          <p className="text-sm font-medium">{formatMs(report.speedIndexMs)}</p>
                        </div>
                        {report.inpMs != null && (
                          <div>
                            <p className="text-xs text-muted-foreground">INP</p>
                            <p className="text-sm font-medium">{formatMs(report.inpMs)}</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
