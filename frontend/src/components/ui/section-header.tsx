import type * as React from 'react';
import { cn } from '@/lib/utils';

export interface SectionHeaderProps {
  title: string;
  /** Right-aligned slot for buttons, links, dropdowns, etc. */
  actions?: React.ReactNode;
  /** Muted helper text shown beneath the title. */
  hint?: string;
  /**
   * `md` (default) — section heading inside a tab.
   * `sm` — sub-section divider; uppercase + tracked.
   */
  size?: 'md' | 'sm';
  className?: string;
}

export function SectionHeader({
  title,
  actions,
  hint,
  size = 'md',
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        {size === 'md' ? (
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
        ) : (
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </h4>
        )}
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
