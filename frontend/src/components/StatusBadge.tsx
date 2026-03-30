import { Badge } from '@/components/ui/badge';
import type { RunStatus } from '../lib/types';

const variants: Record<RunStatus, { label: string; className: string }> = {
  running: {
    label: 'Running',
    className: 'bg-blue-500/20 text-blue-400 ring-blue-500/30 hover:bg-blue-500/20',
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-500/20 text-green-400 ring-green-500/30 hover:bg-green-500/20',
  },
  partial_failure: {
    label: 'Partial',
    className: 'bg-amber-500/20 text-amber-400 ring-amber-500/30 hover:bg-amber-500/20',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-500/20 text-red-400 ring-red-500/30 hover:bg-red-500/20',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-gray-500/20 text-gray-400 ring-gray-500/30 hover:bg-gray-500/20',
  },
};

export function StatusBadge({ status }: { status: RunStatus }) {
  const { label, className } = variants[status] ?? variants.failed;
  return (
    <Badge variant="outline" className={`ring-1 ring-inset border-0 ${className}`}>
      {label}
    </Badge>
  );
}
