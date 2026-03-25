import type { Config, Run, RunDetail, Stats } from './types';
import { authEvents } from './events';

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

export const getRuns = (params: { limit?: number; offset?: number; group?: string } = {}) => {
  const qs = new URLSearchParams({
    limit: String(params.limit ?? 20),
    offset: String(params.offset ?? 0),
    ...(params.group ? { group: params.group } : {}),
  });
  return request<Run[]>('GET', `/runs?${qs}`);
};

export const getLatestRuns = () => request<Run[]>('GET', '/runs/latest');

export const getRunById = (id: number) => request<RunDetail>('GET', `/runs/${id}`);

export const deleteRuns = (group?: string) =>
  request<{ deleted: number }>('DELETE', '/runs', group ? { group } : undefined);

export const triggerAsync = (group: string) =>
  request<{ runId: number }>('POST', '/trigger/async', { group });

export const cancelRun = (id: number) =>
  request<{ ok: boolean }>('POST', `/runs/${id}/cancel`);

export const getConfig = () => request<Config>('GET', '/config');

export const getStats = () => request<Stats>('GET', '/stats');

export const putConfig = (config: Config) =>
  request<{ ok: boolean }>('PUT', '/config', config);
