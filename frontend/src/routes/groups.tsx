import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ChevronRight, LayoutGrid, List, Search, Settings } from 'lucide-react';
import { useState } from 'react';
import { ProjectCard } from '../components/ProjectCard';
import { StatusBadge } from '../components/StatusBadge';
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
import type { GroupHealthSummary, GroupStatus, Run, RunStatus } from '../lib/types';

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

function runStatusToFilter(status: RunStatus | undefined): 'ok' | 'running' | 'partial' {
  if (status === 'running') return 'running';
  if (status === 'partial_failure' || status === 'failed' || status === 'cancelled')
    return 'partial';
  return 'ok';
}

// ── Projects page ─────────────────────────────────────────────────────────────

function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'ok' | 'running' | 'partial'>('all');

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

  const groups = config?.groups ?? [];
  const groupCount = groups.length;

  const filtered = groups.filter((g) => {
    if (
      q &&
      !g.name.toLowerCase().includes(q.toLowerCase()) &&
      !hostFromUrls(g.urls).toLowerCase().includes(q.toLowerCase())
    )
      return false;
    if (filter === 'all') return true;
    return runStatusToFilter(latestByGroup.get(g.name)?.status) === filter;
  });

  const counts = {
    all: groupCount,
    ok: groups.filter((g) => runStatusToFilter(latestByGroup.get(g.name)?.status) === 'ok').length,
    running: groups.filter(
      (g) => runStatusToFilter(latestByGroup.get(g.name)?.status) === 'running',
    ).length,
    partial: groups.filter(
      (g) => runStatusToFilter(latestByGroup.get(g.name)?.status) === 'partial',
    ).length,
  };

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
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
            Workspace · {groupCount} {groupCount === 1 ? 'project' : 'projects'}
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
            Projects<span style={{ color: 'var(--pc-accent)' }}>.</span>
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--muted-foreground)',
              marginTop: 8,
              maxWidth: 560,
              lineHeight: 1.55,
            }}
          >
            Every site this instance is keeping warm. Pick one to inspect runs, URL performance, and
            quality.
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

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(
            [
              ['all', 'All'],
              ['ok', 'Healthy'],
              ['running', 'Running'],
              ['partial', 'Issues'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              style={{
                height: 28,
                padding: '0 12px',
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 500,
                border: '1px solid',
                cursor: 'pointer',
                transition: 'all 0.12s',
                background: filter === k ? 'var(--pc-accent-soft)' : 'transparent',
                color: filter === k ? 'var(--pc-accent)' : 'var(--muted-foreground)',
                borderColor:
                  filter === k
                    ? 'color-mix(in oklab, var(--pc-accent) 35%, transparent)'
                    : 'var(--border)',
              }}
            >
              {label} <span style={{ opacity: 0.65, marginLeft: 2 }}>{counts[k]}</span>
            </button>
          ))}
        </div>

        {/* Search + view toggle */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              padding: '0 10px',
              height: 32,
              width: 220,
              gap: 8,
            }}
          >
            <Search
              style={{ width: 13, height: 13, color: 'var(--muted-foreground)', flexShrink: 0 }}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search projects…"
              style={{
                background: 'none',
                border: 0,
                outline: 'none',
                flex: 1,
                fontSize: 13,
                color: 'var(--foreground)',
              }}
            />
          </div>

          {/* Grid/List toggle */}
          <div
            style={{
              display: 'flex',
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              padding: 3,
              gap: 2,
            }}
          >
            {(
              [
                ['grid', LayoutGrid],
                ['list', List],
              ] as const
            ).map(([v, Icon]) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 5,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.12s',
                  background: view === v ? 'var(--card)' : 'transparent',
                  color: view === v ? 'var(--foreground)' : 'var(--muted-foreground)',
                  boxShadow: view === v ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <Icon style={{ width: 13, height: 13 }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!groupCount ? (
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
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: 60,
            textAlign: 'center',
            color: 'var(--muted-foreground)',
            border: '1px dashed var(--border)',
            borderRadius: 12,
            fontSize: 13,
          }}
        >
          No projects match your filter.
        </div>
      ) : view === 'grid' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}
        >
          {filtered.map((group) => (
            <ProjectCard
              key={group.name}
              group={group}
              latestRun={latestByGroup.get(group.name)}
              publicStatus={statusByGroup.get(group.name)}
              health={healthByGroup.get(group.name)}
              onRunNow={() => trigger.mutate(group.name)}
              isTriggering={trigger.isPending && trigger.variables === group.name}
            />
          ))}
        </div>
      ) : (
        /* List view */
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {/* Table header */}
          <div
            className="font-mono"
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.5fr 1.5fr 60px 80px 90px 90px 18px',
              padding: '10px 18px',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--muted-foreground)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div>Project</div>
            <div>Host</div>
            <div>Schedule</div>
            <div style={{ textAlign: 'right' }}>URLs</div>
            <div style={{ textAlign: 'right' }}>Uptime</div>
            <div style={{ textAlign: 'right' }}>Avg load</div>
            <div>Status</div>
            <div />
          </div>

          {filtered.map((group, idx) => {
            const run = latestByGroup.get(group.name);
            const ps = statusByGroup.get(group.name);
            return (
              <Link
                key={group.name}
                to="/groups/$groupName"
                params={{ groupName: group.name }}
                search={{ tab: 'health', qtab: 'seo' }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.5fr 1.5fr 60px 80px 90px 90px 18px',
                  alignItems: 'center',
                  gap: 8,
                  padding: '13px 18px',
                  borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background 0.12s',
                }}
                className="hover:bg-muted/50"
              >
                <div
                  style={{
                    fontWeight: 500,
                    fontSize: 13.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {group.name}
                </div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: 12,
                    color: 'var(--muted-foreground)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {hostFromUrls(group.urls)}
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 12, color: 'var(--muted-foreground)' }}
                >
                  {describeCron(group.schedule)}
                </div>
                <div className="font-mono" style={{ fontSize: 13, textAlign: 'right' }}>
                  {group.urls.length}
                </div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: 13,
                    textAlign: 'right',
                    color:
                      ps == null
                        ? 'var(--foreground)'
                        : ps.uptimePct >= 99
                          ? 'var(--pc-ok)'
                          : ps.uptimePct >= 95
                            ? 'var(--pc-warn)'
                            : 'var(--pc-bad)',
                  }}
                >
                  {ps != null ? `${ps.uptimePct.toFixed(1)}%` : '—'}
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 13, textAlign: 'right', color: 'var(--muted-foreground)' }}
                >
                  —
                </div>
                <div>{run && <StatusBadge status={run.status} />}</div>
                <ChevronRight style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
