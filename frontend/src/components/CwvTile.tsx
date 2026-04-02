import type { CwvStatus } from "@/lib/types";

const CWV_STATUS_COLOR: Record<CwvStatus, string> = {
  good: 'text-green-500',
  'needs-improvement': 'text-yellow-500',
  poor: 'text-destructive',
};

export function CwvTile({
  label,
  value,
  unit,
  status,
}: {
  label: string;
  value: number | null;
  unit: string;
  status: CwvStatus | null;
}) {
  const color = status ? CWV_STATUS_COLOR[status] : 'text-muted-foreground';
  return (
    <div className="flex flex-col items-center rounded-lg border border-border p-3 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {value != null ? (
        <>
          <p className={`text-xl font-semibold tabular-nums ${color}`}>
            {value}
            {unit}
          </p>
          {status && (
            <p className={`text-xs mt-0.5 ${color}`}>
              {status === 'needs-improvement'
                ? 'Needs work'
                : status.charAt(0).toUpperCase() + status.slice(1)}
            </p>
          )}
        </>
      ) : (
        <p className="text-lg text-muted-foreground">—</p>
      )}
    </div>
  );
}