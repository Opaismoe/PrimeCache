import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { UptimeSegBars } from '../components/UptimeSegBars';
import { getPublicStatus } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

export const Route = createFileRoute('/status')({
  component: StatusPage,
});

function StatusPage() {
  const { data: groups, isLoading } = useQuery({
    queryKey: queryKeys.publicStatus.all(),
    queryFn: getPublicStatus,
    refetchInterval: 60_000,
  });

  const overall =
    groups && groups.length > 0
      ? groups.reduce((s, g) => s + g.uptimePct, 0) / groups.length
      : null;

  const allHealthy = groups?.every((g) => g.uptimePct >= 99) ?? false;
  const anyDown = groups?.some((g) => g.uptimePct < 95) ?? false;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="mb-10">
        <p
          className="mb-2 text-xs font-medium uppercase tracking-widest"
          style={{ color: 'var(--muted-foreground)', letterSpacing: '0.10em' }}
        >
          PrimeCache · Public status
        </p>
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">
          {isLoading
            ? 'Loading…'
            : allHealthy
              ? 'All systems operational'
              : anyDown
                ? 'Service disruption detected'
                : 'Partial degradation'}
          <span style={{ color: 'var(--pc-accent)' }}>.</span>
        </h1>
        {overall !== null && (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Average uptime across all projects ·{' '}
            <span className="font-mono font-medium" style={{ color: 'var(--foreground)' }}>
              {overall.toFixed(2)}%
            </span>{' '}
            over the last 30 days
          </p>
        )}
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && groups?.length === 0 && (
        <p style={{ color: 'var(--muted-foreground)' }}>No data yet — trigger a run first.</p>
      )}

      {/* Groups */}
      {groups && groups.length > 0 && (
        <>
          {/* Column headers */}
          <div
            className="mb-2 grid font-mono text-[11px] uppercase tracking-widest"
            style={{
              gridTemplateColumns: '160px 1fr 70px 18px',
              color: 'var(--muted-foreground)',
              letterSpacing: '0.08em',
              padding: '0 18px',
            }}
          >
            <div>Project</div>
            <div>Timeline · {60} intervals</div>
            <div style={{ textAlign: 'right' }}>Uptime</div>
            <div />
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {groups.map((g, idx) => {
              const isHealthy = g.uptimePct >= 99;
              const isDegraded = g.uptimePct >= 95 && g.uptimePct < 99;
              const dotColor = isHealthy
                ? 'var(--pc-ok)'
                : isDegraded
                  ? 'var(--pc-warn)'
                  : 'var(--pc-bad)';
              const uptimeColor = isHealthy
                ? 'var(--pc-ok)'
                : isDegraded
                  ? 'var(--pc-warn)'
                  : 'var(--pc-bad)';

              return (
                <Link
                  key={g.groupName}
                  to="/groups/$groupName"
                  params={{ groupName: g.groupName }}
                  search={{ tab: 'health', qtab: 'seo' }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '160px 1fr 70px 18px',
                    alignItems: 'center',
                    gap: 16,
                    padding: '14px 18px',
                    borderBottom: idx < groups.length - 1 ? '1px solid var(--border)' : 'none',
                    transition: 'background 0.12s',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                  className="hover:bg-muted/50"
                >
                  {/* Name + dot */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: dotColor,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.2 }}>
                        {g.groupName}
                      </div>
                      <div
                        className="font-mono"
                        style={{
                          fontSize: 11,
                          color: 'var(--muted-foreground)',
                          marginTop: 2,
                        }}
                      >
                        {g.urlCount} {g.urlCount === 1 ? 'URL' : 'URLs'}
                      </div>
                    </div>
                  </div>

                  {/* Uptime bars */}
                  <UptimeSegBars uptimePct={g.uptimePct} groupName={g.groupName} />

                  {/* Uptime % */}
                  <div
                    className="font-mono"
                    style={{
                      textAlign: 'right',
                      fontSize: 13,
                      fontWeight: 500,
                      color: uptimeColor,
                    }}
                  >
                    {g.uptimePct.toFixed(2)}%
                  </div>

                  {/* Chevron */}
                  <ChevronRight
                    style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }}
                  />
                </Link>
              );
            })}
          </div>

          <p className="mt-6 text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Bars show ~60 most recent checks per project · approximated from 30-day aggregate
          </p>
        </>
      )}
    </div>
  );
}
