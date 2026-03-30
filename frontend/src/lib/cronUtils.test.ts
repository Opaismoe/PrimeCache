import { describe, expect, it } from 'vitest';
import { cronToString, describeCron, parseCron } from './cronUtils';

describe('parseCron', () => {
  it('parses every-n-minutes expression', () => {
    expect(parseCron('*/15 * * * *')).toMatchObject({
      type: 'every-n-minutes',
      minuteInterval: 15,
    });
    expect(parseCron('*/1 * * * *')).toMatchObject({ type: 'every-n-minutes', minuteInterval: 1 });
  });

  it('parses every-n-hours expression', () => {
    expect(parseCron('0 */2 * * *')).toMatchObject({ type: 'every-n-hours', hourInterval: 2 });
    expect(parseCron('0 */6 * * *')).toMatchObject({ type: 'every-n-hours', hourInterval: 6 });
  });

  it('parses daily expression', () => {
    expect(parseCron('30 9 * * *')).toMatchObject({ type: 'daily', hour: 9, minute: 30 });
    expect(parseCron('0 0 * * *')).toMatchObject({ type: 'daily', hour: 0, minute: 0 });
  });

  it('parses weekly expression', () => {
    expect(parseCron('0 8 * * 1')).toMatchObject({
      type: 'weekly',
      hour: 8,
      minute: 0,
      dayOfWeek: 1,
    });
    expect(parseCron('30 18 * * 5')).toMatchObject({
      type: 'weekly',
      hour: 18,
      minute: 30,
      dayOfWeek: 5,
    });
  });

  it('falls back to custom for unrecognised expressions', () => {
    // Mixed interval (*/5 */2) doesn't match any named pattern
    expect(parseCron('*/5 */2 * * *')).toMatchObject({ type: 'custom', custom: '*/5 */2 * * *' });
    expect(parseCron('invalid')).toMatchObject({ type: 'custom' });
  });
});

describe('cronToString', () => {
  it('round-trips every-n-minutes', () => {
    expect(cronToString(parseCron('*/15 * * * *'))).toBe('*/15 * * * *');
  });

  it('round-trips every-n-hours', () => {
    expect(cronToString(parseCron('0 */3 * * *'))).toBe('0 */3 * * *');
  });

  it('round-trips daily', () => {
    expect(cronToString(parseCron('30 9 * * *'))).toBe('30 9 * * *');
  });

  it('round-trips weekly', () => {
    expect(cronToString(parseCron('0 8 * * 1'))).toBe('0 8 * * 1');
  });
});

describe('describeCron', () => {
  it('describes every-n-minutes', () => {
    expect(describeCron('*/15 * * * *')).toBe('Every 15 minutes');
    expect(describeCron('*/1 * * * *')).toBe('Every 1 minute');
  });

  it('describes every-n-hours', () => {
    expect(describeCron('0 */2 * * *')).toBe('Every 2 hours');
    expect(describeCron('0 */1 * * *')).toBe('Every 1 hour');
  });

  it('describes daily schedule', () => {
    expect(describeCron('0 9 * * *')).toBe('Daily at 09:00');
    expect(describeCron('30 14 * * *')).toBe('Daily at 14:30');
  });

  it('describes weekly schedule', () => {
    expect(describeCron('0 8 * * 1')).toBe('Monday at 08:00');
    expect(describeCron('0 10 * * 0')).toBe('Sunday at 10:00');
  });

  it('returns raw expression for custom', () => {
    expect(describeCron('*/5 */2 * * *')).toBe('*/5 */2 * * *');
  });
});
