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
};
