import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getGroupLighthouse, triggerGroupLighthouse } from '../../lib/api';
import { formatDate, formatMs } from '../../lib/formatters';
import { queryKeys } from '../../lib/queryKeys';
import { ExternalLink } from '../ExternalLink';

const AUDIT_DURATION_MS = 90_000;

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

  // url -> start timestamp for each in-progress audit
  const [runningUrls, setRunningUrls] = useState<Map<string, number>>(new Map());
  // url -> elapsed seconds (updated every 500ms while running)
  const [elapsed, setElapsed] = useState<Map<string, number>>(new Map());
  // url -> pending (waiting for API ack before starting timer)
  const [pendingUrls, setPendingUrls] = useState<Set<string>>(new Set());
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const { data = [], isLoading } = useQuery({
    queryKey: queryKeys.groups.lighthouse(groupName, formFactor),
    queryFn: () => getGroupLighthouse(groupName, formFactor),
    refetchInterval: runningUrls.size > 0 ? false : 30_000,
  });

  // Tick elapsed counters for all running audits
  useEffect(() => {
    if (runningUrls.size === 0) {
      setElapsed(new Map());
      return;
    }
    const tick = setInterval(() => {
      const now = Date.now();
      setElapsed(
        new Map([...runningUrls].map(([url, start]) => [url, Math.floor((now - start) / 1000)])),
      );
    }, 500);
    return () => clearInterval(tick);
  }, [runningUrls]);

  // Poll every 5s while any audit is in flight so results surface as they arrive
  useEffect(() => {
    if (runningUrls.size === 0) return;
    const poll = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.lighthouse(groupName, formFactor),
      });
    }, 5_000);
    return () => clearInterval(poll);
  }, [runningUrls.size, groupName, formFactor, queryClient]);

  // Clear all timeouts on unmount
  useEffect(() => {
    const ref = timeoutsRef.current;
    return () => { for (const t of ref.values()) clearTimeout(t); };
  }, []);

  const finishUrl = (url: string) => {
    setRunningUrls((prev) => { const next = new Map(prev); next.delete(url); return next; });
    timeoutsRef.current.delete(url);
    queryClient.invalidateQueries({ queryKey: queryKeys.groups.lighthouse(groupName, formFactor) });
  };

  const runUrl = async (url: string) => {
    setPendingUrls((prev) => new Set(prev).add(url));
    try {
      await triggerGroupLighthouse(groupName, formFactor, url);
      setRunningUrls((prev) => new Map(prev).set(url, Date.now()));
      const t = setTimeout(() => {
        finishUrl(url);
        toast.success('Lighthouse audit complete');
      }, AUDIT_DURATION_MS);
      timeoutsRef.current.set(url, t);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to trigger Lighthouse audit');
    } finally {
      setPendingUrls((prev) => { const next = new Set(prev); next.delete(url); return next; });
    }
  };

  const auditByUrl = new Map(data.map((d) => [d.url, d]));
  const allItems =
    groupUrls.length > 0
      ? groupUrls.map((url) => auditByUrl.get(url) ?? { url, latestReport: null })
      : data;

  return (
    <div className="space-y-4">
      {/* Form factor toggle */}
      <div className="flex items-center gap-3">
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
        {runningUrls.size > 0 && (
          <p className="text-xs text-muted-foreground">
            {runningUrls.size} audit{runningUrls.size !== 1 ? 's' : ''} running…
          </p>
        )}
      </div>

      {/* Per-URL cards */}
      {isLoading ? null : allItems.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {allItems.map((item) => {
            const report = item.latestReport;
            const isRunning = runningUrls.has(item.url);
            const isPending = pendingUrls.has(item.url);
            const urlElapsed = elapsed.get(item.url) ?? 0;
            const progress = isRunning
              ? Math.min(95, (urlElapsed / (AUDIT_DURATION_MS / 1000)) * 100)
              : 0;

            return (
              <Card key={item.url}>
                <CardContent className="space-y-4 pt-4">
                  {/* URL + meta + per-URL button */}
                  <div className="flex items-start justify-between gap-2">
                    <ExternalLink
                      href={item.url}
                      className="max-w-xs truncate font-mono text-xs text-muted-foreground"
                    >
                      {item.url}
                    </ExternalLink>
                    <div className="flex shrink-0 items-center gap-2">
                      {isRunning && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {urlElapsed}s
                        </span>
                      )}
                      {!isRunning && report && (
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
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        disabled={isRunning || isPending}
                        onClick={() => runUrl(item.url)}
                      >
                        {isRunning || isPending ? 'Running…' : 'Run'}
                      </Button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {isRunning && (
                    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all duration-500 ease-linear"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}

                  {/* Skeleton while auditing with no result yet */}
                  {!report && isRunning && <CardSkeleton />}

                  {/* No data, not running */}
                  {!report && !isRunning && (
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
