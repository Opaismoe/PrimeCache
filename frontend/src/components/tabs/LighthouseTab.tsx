import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getGroupLighthouse, triggerGroupLighthouse } from '../../lib/api';
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

function CardSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="h-8 w-10 rounded bg-muted" />
            <div className="h-3 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-x-4 gap-y-2 border-t border-border pt-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 w-8 rounded bg-muted" />
            <div className="h-4 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  groupName: string;
  groupUrls: string[];
}

export function LighthouseTab({ groupName, groupUrls }: Props) {
  const queryClient = useQueryClient();
  const [formFactor, setFormFactor] = useState<'mobile' | 'desktop'>('desktop');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const AUDIT_DURATION_MS = 90_000;

  const { data = [], isLoading } = useQuery({
    queryKey: queryKeys.groups.lighthouse(groupName, formFactor),
    queryFn: () => getGroupLighthouse(groupName, formFactor),
    refetchInterval: running ? false : 30_000,
  });

  // Progress timer while running
  useEffect(() => {
    if (!running) {
      setProgress(0);
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const tick = setInterval(() => {
      const ms = Date.now() - start;
      setElapsed(Math.floor(ms / 1000));
      setProgress(Math.min(95, (ms / AUDIT_DURATION_MS) * 100));
    }, 500);
    return () => clearInterval(tick);
  }, [running]);

  // Poll every 5s during run to surface results as they arrive
  useEffect(() => {
    if (!running) return;
    const poll = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.lighthouse(groupName, formFactor),
      });
    }, 5_000);
    return () => clearInterval(poll);
  }, [running, groupName, formFactor, queryClient]);

  const trigger = useMutation({
    mutationFn: () => triggerGroupLighthouse(groupName, formFactor),
    onSuccess: () => {
      setRunning(true);
      setTimeout(() => {
        setRunning(false);
        queryClient.invalidateQueries({
          queryKey: queryKeys.groups.lighthouse(groupName, formFactor),
        });
      }, AUDIT_DURATION_MS);
    },
  });

  // Show all group URLs — merge config list with audit results
  const auditByUrl = new Map(data.map((d) => [d.url, d]));
  const allItems =
    groupUrls.length > 0
      ? groupUrls.map((url) => auditByUrl.get(url) ?? { url, latestReport: null })
      : data;

  const hasAnyData = data.some((d) => d.latestReport !== null);
  const urlCount = allItems.length;

  return (
    <div className="space-y-4">
      {/* Header: form factor toggle + run button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Mobile / Desktop toggle */}
          <div className="flex rounded-md border border-border text-xs font-medium overflow-hidden">
            {(['desktop', 'mobile'] as const).map((ff) => (
              <button
                key={ff}
                type="button"
                onClick={() => setFormFactor(ff)}
                className={`px-3 py-1.5 transition-colors capitalize ${
                  formFactor === ff
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {ff}
              </button>
            ))}
          </div>

          {running ? (
            <p className="text-sm text-muted-foreground">
              Auditing {urlCount} URL{urlCount !== 1 ? 's' : ''}…{' '}
              <span className="tabular-nums">{elapsed}s</span> elapsed
            </p>
          ) : !hasAnyData && !isLoading ? (
            <p className="text-sm text-muted-foreground">
              No {formFactor} audits yet. Trigger one manually or enable{' '}
              <code>checkLighthouse</code> in Settings.
            </p>
          ) : null}
        </div>

        <Button
          onClick={() => trigger.mutate()}
          disabled={running || trigger.isPending}
          size="sm"
          variant="outline"
        >
          {running || trigger.isPending ? 'Running…' : 'Run audit'}
        </Button>
      </div>

      {/* Progress bar */}
      {running && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Cards */}
      {isLoading && !running ? null : allItems.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {allItems.map((item) => {
            const report = item.latestReport;
            return (
              <Card key={item.url}>
                <CardContent className="space-y-4 pt-4">
                  {/* URL + meta */}
                  <div className="flex items-start justify-between gap-2">
                    <ExternalLink
                      href={item.url}
                      className="max-w-xs truncate font-mono text-xs text-muted-foreground"
                    >
                      {item.url}
                    </ExternalLink>
                    <div className="flex shrink-0 items-center gap-2">
                      {running && (
                        <span className="animate-pulse text-xs text-muted-foreground">
                          {report ? 'refreshing…' : 'auditing…'}
                        </span>
                      )}
                      {report && !running && (
                        <>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
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
                        </>
                      )}
                    </div>
                  </div>

                  {/* Skeleton while auditing and no result yet */}
                  {!report && running && <CardSkeleton />}

                  {/* No data, not running */}
                  {!report && !running && (
                    <p className="text-xs text-muted-foreground">No audit yet for this URL.</p>
                  )}

                  {/* Failed */}
                  {report?.failed && (
                    <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {report.error ?? 'Audit failed'}
                    </div>
                  )}

                  {/* Scores + metrics */}
                  {report && !report.failed && (
                    <>
                      <div className="grid grid-cols-4 gap-2">
                        <ScoreCircle label="Performance" score={report.performanceScore} />
                        <ScoreCircle label="Accessibility" score={report.accessibilityScore} />
                        <ScoreCircle label="SEO" score={report.seoScore} />
                        <ScoreCircle label="Best Practices" score={report.bestPracticesScore} />
                      </div>

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
      ) : null}
    </div>
  );
}
