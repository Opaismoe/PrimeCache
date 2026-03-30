export function formatChartDate(iso: unknown): string {
  if (typeof iso !== 'string') return String(iso ?? '');
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
