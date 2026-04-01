export const CHART_TOOLTIP_STYLE = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
} as const;

export const LINE_COLORS = ['#60a5fa', '#a78bfa', '#34d399', '#f472b6', '#fb923c', '#e879f9'];
export const getColor = (i: number) => LINE_COLORS[i % LINE_COLORS.length];
