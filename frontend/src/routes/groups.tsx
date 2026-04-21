import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Clock, History, Play, Settings } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { UptimeSegBars } from '../components/UptimeSegBars';
import {
  getApiKey,
  getConfig,
  getGroupsHealth,
  getLatestRuns,
  getPublicStatus,
  triggerAsync,
} from '../lib/api';
import { describeCron } from '../lib/cronUtils';
import { queryKeys } from '../lib/queryKeys';
import type { GroupHealthSummary, GroupStatus, Run } from '../lib/types';

const configQueryOptions = queryOptions({ queryKey: queryKeys.config.all(), queryFn: getConfig });
const latestRunsQueryOptions = queryOptions({
  queryKey: queryKeys.runs.latest(),
  queryFn: getLatestRuns,
});
const publicStatusQueryOptions = queryOptions({
  queryKey: queryKeys.publicStatus.all(),
  queryFn: getPublicStatus,
  refetchInterval: 60_000,
});

export const Route = createFileRoute('/groups')({
  loader: ({ context: { queryClient } }) => {
    if (!getApiKey()) return;
    return Promise.all([
      queryClient.ensureQueryData(configQueryOptions),
      queryClient.ensureQueryData(latestRunsQueryOptions),
    ]);
  },
  component: ProjectsPage,
});

function hostFromUrls(urls: string[]): string {
  try {
    return new URL(urls[0]).host;
  } catch {
    return urls[0] ?? '';
  }
}

function GroupCard({
  group,
  latestRun,
  health,
  publicStatus,
  onRunNow,
  isTriggering,
}: {
  group: { name: string; schedule: string; urls: string[] };
  latestRun: Run | undefined;
  health: GroupHealthSummary | undefined;
  publicStatus: GroupStatus | undefined;
  onRunNow: () => void;
  isTriggering: boolean;
}) {
  const host = hostFromUrls(group.urls);
  const urlCount = group.urls.length;
  const uptimePct = publicStatus?.uptimePct ?? null;

  const hasIssues = health && Object.values(health.tabs).some(Boolean);

  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      className="hover:shadow-sm"
    >
      {/* Title row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <Link
            to="/groups/$groupName"
            params={{ groupName: group.name }}
            search={{ tab: 'health', qtab: 'seo' }}
            style={{
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              color: 'var(--foreground)',
              textDecoration: 'none',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            className="hover:underline"
          >
            {group.name}
          </Link>
          <div
            className="font-mono"
            style={{
              fontSize: 12,
              color: 'var(--muted-foreground)',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {host}
          </div>
        </div>
        {latestRun && <StatusBadge status={latestRun.status} />}
      </div>

      {/* Uptime bars (if data) */}
      {uptimePct !== null && (
        <UptimeSegBars uptimePct={uptimePct} groupName={group.name} count={40} />
      )}

      {/* Metrics row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}
      >
        <MetricCell label="URLs" value={String(urlCount)} />
        <MetricCell
          label="Success"
          value={
            latestRun?.success_count != null && latestRun.total_urls != null
              ? `${latestRun.success_count}/${latestRun.total_urls}`
              : '—'
          }
          color={latestRun?.failure_count ? 'var(--pc-warn)' : undefined}
        />
        <MetricCell
          label="Uptime"
          value={uptimePct !== null ? `${uptimePct.toFixed(1)}%` : '—'}
          color={
            uptimePct === null
              ? undefined
              : uptimePct >= 99
                ? 'var(--pc-ok)'
                : uptimePct >= 95
                  ? 'var(--pc-warn)'
                  : 'var(--pc-bad)'
          }
        />
      </div>

      {/* Cron + issues */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          color: 'var(--muted-foreground)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock style={{ width: 12, height: 12 }} />
          {describeCron(group.schedule)}
        </span>
        {hasIssues && (
          <span
            style={{
              background: 'var(--pc-warn-soft)',
              color: 'var(--pc-warn)',
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 999,
            }}
          >
            Needs work
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRunNow();
          }}
          disabled={isTriggering}
          style={{
            flex: 1,
            height: 30,
            borderRadius: 7,
            fontSize: 12.5,
            background: 'var(--muted)',
            border: '1px solid var(--border)',
            color: 'var(--muted-foreground)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            cursor: isTriggering ? 'not-allowed' : 'pointer',
            opacity: isTriggering ? 0.6 : 1,
            transition: 'background 0.12s, color 0.12s',
          }}
          className="hover:bg-card hover:text-foreground"
        >
          <Play style={{ width: 12, height: 12 }} />
          {isTriggering ? 'Starting…' : 'Run now'}
        </button>
        <Link
          to="/groups/$groupName"
          params={{ groupName: group.name }}
          search={{ tab: 'history', qtab: 'seo' }}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            height: 30,
            borderRadius: 7,
            fontSize: 12.5,
            background: 'var(--muted)',
            border: '1px solid var(--border)',
            color: 'var(--muted-foreground)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            textDecoration: 'none',
            transition: 'background 0.12s, color 0.12s',
          }}
          className="hover:bg-card hover:text-foreground"
        >
          <History style={{ width: 12, height: 12 }} />
          History
        </Link>
        <Link
          to="/groups/$groupName"
          params={{ groupName: group.name }}
          search={{ tab: 'settings', qtab: 'seo' }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            background: 'var(--muted)',
            border: '1px solid var(--border)',
            color: 'var(--muted-foreground)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            transition: 'background 0.12s, color 0.12s',
          }}
          className="hover:bg-card hover:text-foreground"
        >
          <Settings style={{ width: 12, height: 12 }} />
        </Link>
      </div>
    </div>
  );
}

function MetricCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--muted-foreground)',
        }}
      >
        {label}
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: color ?? 'var(--foreground)',
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: config } = useQuery(configQueryOptions);
  const { data: latestRuns } = useQuery(latestRunsQueryOptions);
  const { data: publicStatusData } = useQuery(publicStatusQueryOptions);
  const { data: healthData } = useQuery({
    queryKey: queryKeys.groups.health(),
    queryFn: getGroupsHealth,
    enabled: !!getApiKey(),
  });

  const trigger = useMutation({
    mutationFn: triggerAsync,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.runs.all() });
      navigate({ to: '/history/$runId', params: { runId: String(data.runId) } });
    },
  });

  const latestByGroup = new Map<string, Run>((latestRuns ?? []).map((r) => [r.group_name, r]));
  const healthByGroup = new Map<string, GroupHealthSummary>(
    (healthData ?? []).map((h) => [h.name, h]),
  );
  const statusByGroup = new Map<string, GroupStatus>(
    (publicStatusData ?? []).map((s) => [s.groupName, s]),
  );

  const groupCount = config?.groups.length ?? 0;
  const totalUrls = config?.groups.reduce((s, g) => s + g.urls.length, 0) ?? 0;

  return (
    <div>
      {/* Header callout */}
      <div
        style={{
          marginBottom: 28,
          padding: '22px 24px',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          alignItems: 'center',
          gap: 16,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: 'absolute',
            right: -40,
            top: -40,
            width: 220,
            height: 220,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at center, var(--pc-accent-soft) 0%, transparent 60%)',
            pointerEvents: 'none',
          }}
        />
        <div>
          <p
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--muted-foreground)',
              marginBottom: 8,
            }}
          >
            Projects · cache-warming jobs
          </p>
          <h1
            style={{
              fontSize: 28,
              letterSpacing: '-0.02em',
              fontWeight: 600,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {groupCount}{' '}
            <span
              style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--muted-foreground)' }}
            >
              {groupCount === 1 ? 'project' : 'projects'}
            </span>
            {totalUrls > 0 && (
              <>
                {', '}
                <span
                  style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--muted-foreground)' }}
                >
                  {totalUrls} URLs
                </span>
              </>
            )}
            <span style={{ color: 'var(--pc-accent)' }}>.</span>
          </h1>
          <p
            style={{
              fontSize: 12.5,
              color: 'var(--muted-foreground)',
              marginTop: 4,
              maxWidth: 560,
              lineHeight: 1.5,
            }}
          >
            Scheduled cache-warming jobs — click any project to inspect performance, uptime, SEO,
            and Core Web Vitals.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Link
            to="/admin"
            search={{ section: 'groups' }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              height: 32,
              padding: '0 12px',
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 500,
              border: '1px solid var(--border)',
              background: 'var(--card)',
              color: 'var(--foreground)',
              textDecoration: 'none',
            }}
          >
            <Settings style={{ width: 13, height: 13 }} />
            Manage
          </Link>
        </div>
      </div>

      {!config?.groups.length ? (
        <p style={{ color: 'var(--muted-foreground)' }}>
          No groups configured yet.{' '}
          <Link
            to="/admin"
            search={{ section: 'groups' }}
            style={{ color: 'inherit', textDecoration: 'underline' }}
          >
            Add a group
          </Link>
          .
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}
        >
          {config.groups.map((group) => (
            <GroupCard
              key={group.name}
              group={group}
              latestRun={latestByGroup.get(group.name)}
              health={healthByGroup.get(group.name)}
              publicStatus={statusByGroup.get(group.name)}
              onRunNow={() => trigger.mutate(group.name)}
              isTriggering={trigger.isPending && trigger.variables === group.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}
