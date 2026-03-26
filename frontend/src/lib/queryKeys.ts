export const queryKeys = {
  runs: {
    all: () => ['runs'] as const,
    list: (page: number, group: string) => ['runs', 'list', page, group] as const,
    latest: () => ['runs', 'latest'] as const,
    detail: (id: number) => ['runs', id] as const,
  },
  config: {
    all: () => ['config'] as const,
  },
  stats: {
    all: () => ['stats'] as const,
  },
  groups: {
    overview:    (name: string) => ['groups', name, 'overview'] as const,
    performance: (name: string) => ['groups', name, 'performance'] as const,
    uptime:      (name: string) => ['groups', name, 'uptime'] as const,
    seo:         (name: string) => ['groups', name, 'seo'] as const,
  },
};
