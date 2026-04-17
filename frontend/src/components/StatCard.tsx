/**
 * @deprecated Use `<Metric>` from `@/components/ui/metric` instead.
 *
 * Kept as a thin shim so existing call sites compile during the redesign
 * (see .ai/frontend-redesign.md). Will be removed in Batch 6 once all call
 * sites have migrated.
 */
import { Metric } from '@/components/ui/metric';

export function StatCard({ label, value }: { label: string; value: string }) {
  return <Metric label={label} value={value} />;
}
