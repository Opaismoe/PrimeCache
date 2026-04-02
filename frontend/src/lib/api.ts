import { authEvents } from './events';
import type {
  BrokenLinkSummary,
  Config,
  GroupAccessibility,
  GroupCwv,
  GroupHealthSummary,
  GroupOverview,
  GroupPerformance,
  GroupSeo,
  GroupStatus,
  GroupUptime,
  Run,
  RunDetail,
  Stats,
} from './types';

const API_KEY_STORAGE = 'primecache-api-key';

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE);
}

export function saveApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key);
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues?: unknown[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor() {
    super(401, 'Invalid API key');
    this.name = 'UnauthorizedError';
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const apiKey = getApiKey();
  const res = await fetch(path, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    authEvents.emitUnauthorized();
    throw new UnauthorizedError();
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new ApiError(res.status, data.error ?? `HTTP ${res.status}`, data.issues);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function login(username: string, password: string): Promise<{ token: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new ApiError(res.status, data.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const getRuns = (params: { limit?: number; offset?: number; group?: string } = {}) => {
  const qs = new URLSearchParams({
    limit: String(params.limit ?? 20),
    offset: String(params.offset ?? 0),
    ...(params.group ? { group: params.group } : {}),
  });
  return request<Run[]>('GET', `/api/runs?${qs}`);
};

export const getLatestRuns = () => request<Run[]>('GET', '/api/runs/latest');

export const getRunById = (id: number) => request<RunDetail>('GET', `/api/runs/${id}`);

export const deleteRuns = (group?: string) =>
  request<{ deleted: number }>('DELETE', '/api/runs', group ? { group } : undefined);

export const triggerAsync = (group: string) =>
  request<{ runId: number }>('POST', '/api/trigger/async', { group });

export const cancelRun = (id: number) => request<{ ok: boolean }>('POST', `/api/runs/${id}/cancel`);

export const getConfig = () => request<Config>('GET', '/api/config');

export const getStats = () => request<Stats>('GET', '/api/stats');

export const putConfig = (config: Config, renames?: { from: string; to: string }[]) =>
  request<{ ok: boolean }>('PUT', '/api/config', renames?.length ? { ...config, renames } : config);

export const getGroupOverview = (name: string) =>
  request<GroupOverview>('GET', `/api/groups/${encodeURIComponent(name)}/overview`);

export const getGroupPerformance = (name: string, threshold = 3000) =>
  request<GroupPerformance>(
    'GET',
    `/api/groups/${encodeURIComponent(name)}/performance?threshold=${threshold}`,
  );

export const getGroupUptime = (name: string) =>
  request<GroupUptime>('GET', `/api/groups/${encodeURIComponent(name)}/uptime`);

export const getGroupSeo = (name: string) =>
  request<GroupSeo>('GET', `/api/groups/${encodeURIComponent(name)}/seo`);

export const getGroupBrokenLinks = (name: string) =>
  request<BrokenLinkSummary[]>('GET', `/api/groups/${encodeURIComponent(name)}/broken-links`);

export const getGroupAccessibility = (name: string) =>
  request<GroupAccessibility>('GET', `/api/groups/${encodeURIComponent(name)}/accessibility`);

export const getGroupCwv = (name: string) =>
  request<GroupCwv>('GET', `/api/groups/${encodeURIComponent(name)}/cwv`);

export const getPublicStatus = () =>
  fetch('/api/public/status').then((r) => r.json() as Promise<GroupStatus[]>);

export const getGroupExportUrl = (name: string, tab: string) =>
  `/api/groups/${encodeURIComponent(name)}/export?tab=${tab}`;

export const getGroupsHealth = () => request<GroupHealthSummary[]>('GET', '/api/groups-health');
