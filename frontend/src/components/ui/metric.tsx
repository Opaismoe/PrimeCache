import type * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type MetricTone = 'default' | 'good' | 'warn' | 'bad';

const TONE_CLASS: Record<MetricTone, string> = {
  default: '',
  good: 'text-green-500',
  warn: 'text-yellow-500',
  bad: 'text-destructive',
};

const VALUE_SIZE: Record<NonNullable<MetricProps['size']>, string> = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
};

export interface MetricProps {
  label: string;
  /** Pass `null` or `undefined` to render an em-dash placeholder. */
  value: React.ReactNode | null | undefined;
  /** Optional unit appended after the value, e.g. `ms`, `%`. */
  unit?: string;
  /**
   * Optional change since previous period. Pass `null`/`undefined` or `0` to
   * suppress the arrow. The component intentionally has no built-in noise
   * floor — pass `null` from the caller when the delta is too small to matter.
   */
  delta?: number | null;
  /**
   * When `delta` is provided, controls which direction is "good".
   * Defaults to `true` (higher value = better, like uptime%).
   */
  higherIsBetter?: boolean;
  /** Colors the value. Independent of the delta-derived arrow color. */
  tone?: MetricTone;
  /** Small text below the value, e.g. "Needs work". Inherits `tone` color. */
  hint?: string;
  size?: 'sm' | 'md' | 'lg';
  align?: 'start' | 'center';
  /** Wrap in a `<Card>`. Set to `false` to render a bare bordered tile. */
  card?: boolean;
  className?: string;
}

export function Metric({
  label,
  value,
  unit,
  delta,
  higherIsBetter = true,
  tone = 'default',
  hint,
  size = 'md',
  align = 'start',
  card = true,
  className,
}: MetricProps) {
  const isEmpty = value == null;
  const valueColor = TONE_CLASS[tone];
  const arrow = computeArrow(delta, higherIsBetter);

  const body = (
    <div className={cn('flex flex-col gap-0.5', align === 'center' && 'items-center text-center')}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-1.5">
        {isEmpty ? (
          <span className="text-lg text-muted-foreground">—</span>
        ) : (
          <span className={cn('font-semibold tabular-nums', VALUE_SIZE[size], valueColor)}>
            {value}
            {unit ? <span className="ml-0.5 text-xs font-medium opacity-70">{unit}</span> : null}
          </span>
        )}
        {arrow && (
          <span
            role="img"
            aria-label={arrow.label}
            className={cn('text-xs font-medium', arrow.className)}
          >
            {arrow.icon}
          </span>
        )}
      </div>
      {hint && <p className={cn('text-xs', valueColor || 'text-muted-foreground')}>{hint}</p>}
    </div>
  );

  if (!card) {
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-card/40 px-4 py-3',
          align === 'center' && 'text-center',
          className,
        )}
      >
        {body}
      </div>
    );
  }

  return (
    <Card size="sm" className={className}>
      <CardContent>{body}</CardContent>
    </Card>
  );
}

function computeArrow(
  delta: number | null | undefined,
  higherIsBetter: boolean,
): { icon: '↑' | '↓'; className: string; label: string } | null {
  if (delta == null || delta === 0) return null;
  const up = delta > 0;
  const isGood = higherIsBetter ? up : !up;
  return {
    icon: up ? '↑' : '↓',
    className: isGood ? 'text-green-500' : 'text-destructive',
    label: up ? 'increase' : 'decrease',
  };
}
