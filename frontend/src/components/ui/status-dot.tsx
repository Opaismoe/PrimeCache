import { cn } from '@/lib/utils';

export type StatusTone = 'ok' | 'warn' | 'bad' | 'idle';

const TONE_BG: Record<StatusTone, string> = {
  ok: 'bg-green-500',
  warn: 'bg-yellow-500',
  bad: 'bg-destructive',
  idle: 'bg-muted-foreground',
};

const TONE_PING: Record<StatusTone, string> = {
  ok: 'bg-green-500/60',
  warn: 'bg-yellow-500/60',
  bad: 'bg-destructive/60',
  idle: 'bg-muted-foreground/60',
};

const SIZE_DIMS = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
} as const;

export interface StatusDotProps {
  tone: StatusTone;
  /** When true, renders an animated halo for "live" status indicators. */
  pulse?: boolean;
  size?: keyof typeof SIZE_DIMS;
  className?: string;
}

export function StatusDot({ tone, pulse = false, size = 'md', className }: StatusDotProps) {
  const dims = SIZE_DIMS[size];
  return (
    <span className={cn('relative inline-flex shrink-0', dims, className)}>
      {pulse && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full',
            TONE_PING[tone],
          )}
        />
      )}
      <span className={cn('relative inline-flex rounded-full', dims, TONE_BG[tone])} />
    </span>
  );
}
