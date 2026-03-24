import type { RunStatus } from '../lib/types';

const variants: Record<RunStatus, { label: string; className: string }> = {
  running: { label: 'Running', className: 'bg-blue-500/20 text-blue-400 ring-blue-500/30' },
  completed: { label: 'Completed', className: 'bg-green-500/20 text-green-400 ring-green-500/30' },
  partial_failure: { label: 'Partial', className: 'bg-amber-500/20 text-amber-400 ring-amber-500/30' },
  failed: { label: 'Failed', className: 'bg-red-500/20 text-red-400 ring-red-500/30' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-500/20 text-gray-400 ring-gray-500/30' },
};

export function StatusBadge({ status }: { status: RunStatus }) {
  const { label, className } = variants[status] ?? variants.failed;
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {label}
    </span>
  );
}
