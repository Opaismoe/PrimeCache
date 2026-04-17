import { StatusDot, type StatusTone } from '@/components/ui/status-dot';
import { cn } from '@/lib/utils';

const TONE_TEXT: Record<StatusTone, string> = {
  ok: 'text-green-500',
  warn: 'text-yellow-500',
  bad: 'text-destructive',
  idle: 'text-muted-foreground',
};

const TONE_RING: Record<StatusTone, string> = {
  ok: 'ring-green-500/30 bg-green-500/10',
  warn: 'ring-yellow-500/30 bg-yellow-500/10',
  bad: 'ring-destructive/30 bg-destructive/10',
  idle: 'ring-border bg-muted/40',
};

export interface StatusPillProps {
  tone: StatusTone;
  label: string;
  /** Optional secondary text, e.g. "12m ago". Rendered muted, after a separator. */
  detail?: string;
  pulse?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusPill({
  tone,
  label,
  detail,
  pulse = false,
  size = 'md',
  className,
}: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        size === 'sm' && 'px-2 py-0.5 text-[11px]',
        TONE_RING[tone],
        TONE_TEXT[tone],
        className,
      )}
    >
      <StatusDot tone={tone} pulse={pulse} size="sm" />
      <span>{label}</span>
      {detail && (
        <>
          <span aria-hidden="true" className="text-muted-foreground/60">
            ·
          </span>
          <span className="font-normal text-muted-foreground">{detail}</span>
        </>
      )}
    </span>
  );
}
