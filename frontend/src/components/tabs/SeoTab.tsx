import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { GroupCwv, UrlSeoSummary } from '@/lib/types';
// import { CwvTile } from '../CwvTile';
import { ExternalLink } from '../ExternalLink';
import { SeoFieldRow } from '../SeoFieldRow';

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 80) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  return 'text-destructive';
}

export function SeoTab({
  data,
  cwv,
}: {
  data: { urls: UrlSeoSummary[] };
  cwv: GroupCwv | undefined;
}) {
  const issueCount = data.urls.reduce((n, u) => n + u.issues.length, 0);
  const changedCount = data.urls.filter((u) => u.changed).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        {issueCount > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span className="font-medium">
              {issueCount} SEO {issueCount === 1 ? 'issue' : 'issues'}
            </span>
            <span className="text-muted-foreground">
              across {data.urls.filter((u) => u.issues.length > 0).length} URLs
            </span>
          </div>
        )}
        {changedCount > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
            <span className="font-medium">
              {changedCount} {changedCount === 1 ? 'URL' : 'URLs'} changed
            </span>
            <span className="text-muted-foreground">since last run</span>
          </div>
        )}
        {data.urls.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No SEO data collected — visits may be failing. Check the Uptime tab for errors.
          </p>
        )}
      </div>

      {/* {cwv && cwv.urls.length > 0 && <CwvSection cwv={cwv} />} */}

      <div className="flex flex-col gap-3">
        {data.urls.map((u) => {
          // const urlCwv: UrlCwv | undefined = cwv?.urls.find((c) => c.url === u.url);
          return (
            <Card key={u.url}>
              {/* {cwv && (
                <div className="border-b border-border px-4 pt-4 pb-3">
                  <p className="mb-2 text-xs text-muted-foreground font-medium">
                    Core Web Vitals (P75)
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    <CwvTile
                      label="LCP"
                      value={urlCwv?.lcpP75 ?? null}
                      unit="ms"
                      status={urlCwv?.lcpStatus ?? null}
                    />
                    <CwvTile
                      label="FCP"
                      value={urlCwv?.fcpP75 ?? null}
                      unit="ms"
                      status={urlCwv?.fcpStatus ?? null}
                    />
                    <CwvTile
                      label="CLS"
                      value={urlCwv?.clsP75 ?? null}
                      unit=""
                      status={urlCwv?.clsStatus ?? null}
                    />
                    <CwvTile
                      label="INP"
                      value={urlCwv?.inpP75 ?? null}
                      unit="ms"
                      status={urlCwv?.inpStatus ?? null}
                    />
                  </div>
                </div>
              )} */}

              <CardContent className="pt-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {u.changed && (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-yellow-500 text-yellow-600 dark:text-yellow-400 text-xs"
                      >
                        Changed
                      </Badge>
                    )}
                    <ExternalLink
                      href={u.url}
                      className="truncate font-mono text-xs text-muted-foreground"
                    >
                      {u.url}
                    </ExternalLink>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-lg font-bold ${scoreColor(u.score)}`}>{u.score}</span>
                    <span className="text-xs text-muted-foreground">/ 100</span>
                  </div>
                </div>

                {u.issues.length > 0 && (
                  <div className="mb-3 rounded-md bg-destructive/10 px-3 py-2">
                    <ul className="space-y-0.5">
                      {u.issues.map((issue) => (
                        <li
                          key={issue}
                          className="flex items-start gap-1.5 text-xs text-destructive"
                        >
                          <span className="mt-0.5 shrink-0">✕</span>
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {u.latestSeo && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors">
                      <span className="font-medium">SEO details</span>
                      <span className="text-xs">▼</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="rounded-b-md border border-t-0 border-border px-3 py-1">
                        <SeoFieldRow label="Title" value={u.latestSeo.title} />
                        <SeoFieldRow label="Meta description" value={u.latestSeo.metaDescription} />
                        <SeoFieldRow label="H1" value={u.latestSeo.h1} />
                        <SeoFieldRow label="H2" value={u.latestSeo.h2} />
                        <SeoFieldRow label="H3" value={u.latestSeo.h3} />
                        <SeoFieldRow label="H4" value={u.latestSeo.h4} />
                        <SeoFieldRow label="H5" value={u.latestSeo.h5} />
                        <SeoFieldRow label="Canonical URL" value={u.latestSeo.canonicalUrl} />
                        <SeoFieldRow label="og:title" value={u.latestSeo.ogTitle} />
                        <SeoFieldRow label="og:description" value={u.latestSeo.ogDescription} />
                        <SeoFieldRow label="og:image" value={u.latestSeo.ogImage} />
                        <SeoFieldRow label="Viewport" value={u.latestSeo.viewportMeta} />
                        <SeoFieldRow label="Lang" value={u.latestSeo.lang} />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {u.changed && u.history.length >= 2 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      Changes since previous run
                    </p>
                    <div className="space-y-1">
                      {(['title', 'metaDescription', 'h1', 'canonicalUrl'] as const).map(
                        (field) => {
                          const prev = u.history[1].seo[field];
                          const curr = u.history[0].seo[field];
                          if (prev === curr) return null;
                          const labels: Record<string, string> = {
                            title: 'Title',
                            metaDescription: 'Meta description',
                            h1: 'H1',
                            canonicalUrl: 'Canonical',
                          };
                          return (
                            <div
                              key={field}
                              className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs"
                            >
                              <span className="font-medium text-yellow-600 dark:text-yellow-400">
                                {labels[field]}
                              </span>
                              <div className="mt-1 text-muted-foreground line-through">
                                {prev ?? '(empty)'}
                              </div>
                              <div className="mt-0.5 text-foreground">{curr ?? '(empty)'}</div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
