import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimitTracker, RATE_LIMIT_CATEGORIES } from './rateLimits';

describe('RateLimitTracker', () => {
  let tracker: RateLimitTracker;

  beforeEach(() => {
    tracker = new RateLimitTracker();
  });

  it('initialises all categories with zero usage', () => {
    const stats = tracker.getStats();
    expect(stats.read.used).toBe(0);
    expect(stats.write.used).toBe(0);
    expect(stats.trigger.used).toBe(0);
  });

  it('returns the configured max for each category', () => {
    const stats = tracker.getStats();
    expect(stats.read.max).toBe(RATE_LIMIT_CATEGORIES.read.max);
    expect(stats.write.max).toBe(RATE_LIMIT_CATEGORIES.write.max);
    expect(stats.trigger.max).toBe(RATE_LIMIT_CATEGORIES.trigger.max);
  });

  it('updates usage from rate limit headers', () => {
    tracker.update('read', { limit: 120, remaining: 107, resetTimestamp: Date.now() + 60_000 });
    const stats = tracker.getStats();
    expect(stats.read.used).toBe(13);
  });

  it('clamps used to max when remaining is negative', () => {
    tracker.update('trigger', { limit: 10, remaining: -1, resetTimestamp: Date.now() + 60_000 });
    const stats = tracker.getStats();
    expect(stats.trigger.used).toBe(10);
  });

  it('returns resetInMs as a positive number', () => {
    const future = Date.now() + 30_000;
    tracker.update('write', { limit: 30, remaining: 28, resetTimestamp: future });
    const stats = tracker.getStats();
    expect(stats.write.resetInMs).toBeGreaterThan(0);
    expect(stats.write.resetInMs).toBeLessThanOrEqual(30_000);
  });
});
