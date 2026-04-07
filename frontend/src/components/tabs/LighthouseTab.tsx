import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  deleteGroupCrawledUrl,
  getGroupCrawledUrls,
  getGroupLighthouse,
  triggerGroupLighthouse,
} from '../../lib/api';
import { auditStore } from '../../lib/auditStore';
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

/** Indeterminate progress bar — honest about unknown duration */
function IndeterminateBar() {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
      <div className="animate-lh-scan h-full rounded-full bg-primary" />
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
  const [pendingUrls, setPendingUrls] = useState<Set<string>>(new Set());

  // Subscribe to the module-level audit store — survives tab/page switches
  const [storeEntries, setStoreEntries] = useState(() =>
    auditStore.forGroup(groupName, formFactor),
  );
  useEffect(() => {
    setStoreEntries(auditStore.forGroup(groupName, formFactor));
    return auditStore.subscribe(() => setStoreEntries(auditStore.forGroup(groupName, formFactor)));
  }, [groupName, formFactor]);
  const runningUrls = new Map(storeEntries.map((e) => [e.url, e.startedAt]));

  // Elapsed timer — re-renders every 500ms while audits are running
  const [, setTick] = useState(0);
  useEffect(() => {
    if (runningUrls.size === 0) return;
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [runningUrls.size]);

  // On mount: dismiss any Sonner toasts that were shown while we were away,
  // and reconnect the onFinish callbacks so query invalidation still fires
  useEffect(() => {
    const entries = auditStore.forGroup(groupName, formFactor);
    for (const entry of entries) {
      if (entry.toastShown) {
        toast.dismiss(`audit:${entry.url}`);
        auditStore.clearToast(entry.url);
      }
      auditStore.setOnFinish(entry.url, (url) => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.groups.lighthouse(groupName, formFactor),
        });
        toast.success('Lighthouse audit complete', { description: url.split('/').pop() });
      });
    }
  }, [groupName, formFactor, queryClient]);

  // On unmount: show a Sonner loading toast for any audit still in flight
  useEffect(() => {
    return () => {
      for (const entry of auditStore.forGroup(groupName, formFactor)) {
        if (!entry.toastShown) {
          auditStore.markToastShown(entry.url);
          toast.loading('Lighthouse audit running…', {
            id: `audit:${entry.url}`,
            description: entry.url.split('/').pop(),
            duration: Number.POSITIVE_INFINITY,
          });
          // Replace onFinish so the toast gets dismissed on completion
          auditStore.setOnFinish(entry.url, (url) => {
            toast.dismiss(`audit:${url}`);
            toast.success('Lighthouse audit complete', { description: url.split('/').pop() });
            queryClient.invalidateQueries({
              queryKey: queryKeys.groups.lighthouse(groupName, formFactor),
            });
          });
        }
      }
    };
  }, [groupName, formFactor, queryClient]);

  // Poll every 5s while audits are in flight
  useEffect(() => {
    if (runningUrls.size === 0) return;
    const poll = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.lighthouse(groupName, formFactor),
      });
    }, 5_000);
    return () => clearInterval(poll);
  }, [runningUrls.size, groupName, formFactor, queryClient]);

  const { data = [], isLoading } = useQuery({
    queryKey: queryKeys.groups.lighthouse(groupName, formFactor),
    queryFn: () => getGroupLighthouse(groupName, formFactor),
    refetchInterval: runningUrls.size > 0 ? false : 30_000,
  });

  const { data: crawledUrls = [] } = useQuery({
    queryKey: queryKeys.groups.crawledUrls(groupName),
    queryFn: () => getGroupCrawledUrls(groupName),
  });

  const removeCrawledUrl = useMutation({
    mutationFn: (url: string) => deleteGroupCrawledUrl(groupName, url),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.crawledUrls(groupName) }),
    onError: () => toast.error('Failed to remove URL'),
  });

  const runUrl = async (url: string) => {
    setPendingUrls((prev) => new Set(prev).add(url));
    try {
      await triggerGroupLighthouse(groupName, formFactor, url);
      auditStore.start(url, groupName, formFactor, (finishedUrl) => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.groups.lighthouse(groupName, formFactor),
        });
        toast.success('Lighthouse audit complete', {
          description: finishedUrl.split('/').pop(),
        });
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to trigger Lighthouse audit');
    } finally {
      setPendingUrls((prev) => {
        const next = new Set(prev);
        next.delete(url);
        return next;
      });
    }
  };

  const auditByUrl = new Map(data.map((d) => [d.url, d]));
  const configUrlSet = new Set(groupUrls);
  const configItems = (groupUrls.length > 0 ? groupUrls : data.map((d) => d.url)).map((url) => ({
    url,
    latestReport: auditByUrl.get(url)?.latestReport ?? null,
    isCrawled: false,
  }));
  const crawledItems = crawledUrls
    .filter((c) => !configUrlSet.has(c.url))
    .map((c) => ({
      url: c.url,
      latestReport: auditByUrl.get(c.url)?.latestReport ?? null,
      isCrawled: true,
    }));
  const allItems = [...configItems, ...crawledItems];

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
            const startedAt = runningUrls.get(item.url);
            const urlElapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;

            return (
              <Card key={item.url}>
                <CardContent className="space-y-4 pt-4">
                  {/* URL + meta + per-URL button */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-1">
                      {item.isCrawled && (
                        <Badge variant="secondary" className="w-fit text-xs">
                          Crawled
                        </Badge>
                      )}
                      <ExternalLink
                        href={item.url}
                        className="truncate font-mono text-xs text-muted-foreground"
                      >
                        {item.url}
                      </ExternalLink>
                    </div>
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
                      {item.isCrawled && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                          disabled={removeCrawledUrl.isPending}
                          onClick={() => removeCrawledUrl.mutate(item.url)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Indeterminate progress bar — shown while auditing */}
                  {isRunning && <IndeterminateBar />}

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
