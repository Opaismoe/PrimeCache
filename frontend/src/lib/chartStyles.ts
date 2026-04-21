export const CHART_TOOLTIP_STYLE = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
} as const;

// Calm 6-project palette from design
export const LINE_COLORS = ['#6E8AFF', '#A87BFF', '#3FBF7F', '#E57EB0', '#E9B971', '#E5884A'];
export const getColor = (i: number) => LINE_COLORS[i % LINE_COLORS.length];

// Run outcome colors — amber accent system
export const STATUS_COLORS: Record<string, string> = {
  completed: 'oklch(74% 0.13 150)',
  partial_failure: 'oklch(80% 0.14 75)',
  failed: 'oklch(68% 0.16 20)',
  cancelled: 'oklch(60% 0.01 260)',
};

export const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  partial_failure: 'Partial failure',
  failed: 'Failed',
  cancelled: 'Cancelled',
};
