import { describe, expect, it } from 'vitest';
import { formatDuration, formatMs } from './formatters';

describe('formatMs', () => {
  it('returns dash for null', () => {
    expect(formatMs(null)).toBe('—');
  });

  it('formats sub-second as ms', () => {
    expect(formatMs(0)).toBe('0ms');
    expect(formatMs(500)).toBe('500ms');
    expect(formatMs(999)).toBe('999ms');
  });

  it('formats 1s and above in seconds with two decimals', () => {
    expect(formatMs(1000)).toBe('1.00s');
    expect(formatMs(1500)).toBe('1.50s');
    expect(formatMs(2340)).toBe('2.34s');
  });
});

describe('formatDuration', () => {
  it('returns ellipsis when end is null', () => {
    expect(formatDuration('2024-01-01T00:00:00Z', null)).toBe('…');
  });

  it('formats sub-second durations as ms', () => {
    expect(formatDuration('2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.500Z')).toBe('500ms');
  });

  it('formats durations under a minute in seconds', () => {
    expect(formatDuration('2024-01-01T00:00:00Z', '2024-01-01T00:00:05Z')).toBe('5.0s');
  });

  it('formats durations of a minute or more as m s', () => {
    expect(formatDuration('2024-01-01T00:00:00Z', '2024-01-01T00:01:30Z')).toBe('1m 30s');
    expect(formatDuration('2024-01-01T00:00:00Z', '2024-01-01T00:02:00Z')).toBe('2m 0s');
  });
});
