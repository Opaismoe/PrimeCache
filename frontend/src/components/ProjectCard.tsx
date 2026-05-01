import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Clock, History, Play, Settings } from 'lucide-react';
import { getGroupOverview } from '../lib/api';
import { describeCron } from '../lib/cronUtils';
import { queryKeys } from '../lib/queryKeys';
import type { Group, GroupHealthSummary, GroupStatus, Run } from '../lib/types';
import { Sparkline } from './Sparkline';
import { StatusBadge } from './StatusBadge';

interface ProjectCardProps {
  group: Group;
  latestRun: Run | undefined;
  publicStatus: GroupStatus | undefined;
  health?: GroupHealthSummary;
  onRunNow: () => void;
  isTriggering: boolean;
}

export function ProjectCard({
  group,
  latestRun,
  publicStatus,
  health,
  onRunNow,
  isTriggering,
}: ProjectCardProps) {
  const { data: overview } = useQuery({
    queryKey: queryKeys.groups.overview(group.name),
    queryFn: () => getGroupOverview(group.name),
    staleTime: 5 * 60 * 1000,
  });

  const host = (() => {
    try {
      return new URL(group.urls[0]).host;
    } catch {
      return group.urls[0] ?? '';
    }
  })();

  const sparkData = (overview?.series ?? []).slice(-20).map((s) => s.avgLoadTimeMs);
  const avgLoad = overview?.stats.avgLoadTimeMs ?? null;
  const totalRuns = overview?.stats.totalRuns ?? null;
  const uptime = publicStatus?.uptimePct ?? null;
  const hasIssues = health && Object.values(health.tabs).some(Boolean);

  const isWarn = latestRun?.status === 'partial_failure' || latestRun?.status === 'failed';
  const sparkColor = isWarn ? 'var(--pc-warn)' : 'var(--pc-accent)';
  const uptimeColor =
    uptime === null
      ? 'var(--foreground)'
      : uptime >= 99
        ? 'var(--pc-ok)'
        : uptime >= 95
          ? 'var(--pc-warn)'
          : 'var(--pc-bad)';

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
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      className="hover:border-amber-500/40 hover:shadow-sm"
    >
      {/* Title row — links to project detail */}
      <Link
        to="/groups/$groupName"
        params={{ groupName: group.name }}
        search={{ tab: 'health', qtab: 'seo' }}
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 500,
                letterSpacing: '-0.01em',
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
      </Link>

      {/* Sparkline */}
      <div style={{ height: 36 }}>
        {sparkData.length >= 2 ? (
          <Sparkline data={sparkData} color={sparkColor} height={36} />
        ) : (
          <div style={{ height: 36, background: 'var(--muted)', borderRadius: 6, opacity: 0.4 }} />
        )}
      </div>

      {/* Schedule + URL count */}
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
          <Clock style={{ width: 12, height: 12, flexShrink: 0 }} />
          {describeCron(group.schedule)}
        </span>
        <span className="font-mono" style={{ flexShrink: 0 }}>
          {group.urls.length} URLs
        </span>
      </div>

      {/* Footer metrics */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11.5,
          color: 'var(--muted-foreground)',
          paddingTop: 10,
          borderTop: '1px solid var(--border)',
        }}
      >
        <span>
          Uptime{' '}
          <span className="font-mono" style={{ color: uptimeColor }}>
            {uptime !== null ? `${uptime.toFixed(1)}%` : '—'}
          </span>
        </span>
        <span>
          Avg{' '}
          <span className="font-mono" style={{ color: 'var(--foreground)' }}>
            {avgLoad !== null ? `${Math.round(avgLoad)}ms` : '—'}
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {hasIssues && (
            <span
              style={{
                background: 'var(--pc-warn-soft)',
                color: 'var(--pc-warn)',
                fontSize: 10,
                padding: '1px 7px',
                borderRadius: 999,
              }}
            >
              Needs work
            </span>
          )}
          {totalRuns !== null && <span>{totalRuns} runs</span>}
        </span>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={onRunNow}
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
