export type RateLimitCategory = 'read' | 'write' | 'trigger';

declare module 'fastify' {
  interface FastifyContextConfig {
    rateLimitCategory?: RateLimitCategory;
  }
}

export const RATE_LIMIT_CATEGORIES: Record<
  RateLimitCategory,
  { max: number; timeWindowMs: number }
> = {
  read: { max: 120, timeWindowMs: 60_000 },
  write: { max: 30, timeWindowMs: 60_000 },
  trigger: { max: 10, timeWindowMs: 60_000 },
};

interface CategoryState {
  used: number;
  max: number;
  resetTimestamp: number;
}

export interface RateLimitStats {
  read: { used: number; max: number; resetInMs: number };
  write: { used: number; max: number; resetInMs: number };
  trigger: { used: number; max: number; resetInMs: number };
}

export class RateLimitTracker {
  private state: Record<RateLimitCategory, CategoryState> = {
    read: { used: 0, max: RATE_LIMIT_CATEGORIES.read.max, resetTimestamp: 0 },
    write: { used: 0, max: RATE_LIMIT_CATEGORIES.write.max, resetTimestamp: 0 },
    trigger: { used: 0, max: RATE_LIMIT_CATEGORIES.trigger.max, resetTimestamp: 0 },
  };

  update(
    category: RateLimitCategory,
    headers: { limit: number; remaining: number; resetTimestamp: number },
  ): void {
    if (headers.limit <= 0) return;
    const remaining = Math.max(0, Math.min(headers.remaining, headers.limit));
    const used = headers.limit - remaining;
    this.state[category] = {
      used,
      max: headers.limit,
      resetTimestamp: headers.resetTimestamp,
    };
  }

  getStats(): RateLimitStats {
    const now = Date.now();
    const toEntry = (cat: RateLimitCategory) => {
      const s = this.state[cat];
      return {
        used: s.used,
        max: s.max,
        resetInMs: Math.max(0, s.resetTimestamp - now),
      };
    };
    return { read: toEntry('read'), write: toEntry('write'), trigger: toEntry('trigger') };
  }
}

export const rateLimitTracker = new RateLimitTracker();
