import { CheckIcon, CopyIcon, ExternalLinkIcon } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AccessibilityViolation, UrlAccessibilitySummary } from '@/lib/types';

const IMPACT_COLORS: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  serious: 'bg-orange-500 text-white',
  moderate: 'bg-yellow-500 text-black',
  minor: 'bg-muted text-muted-foreground',
};

const IMPACT_ORDER: Record<string, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
};

type ImpactFilter = 'all' | 'critical' | 'serious' | 'moderate' | 'minor';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-1 inline-flex items-center rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
      title="Copy to clipboard"
    >
      {copied ? (
        <CheckIcon className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <CopyIcon className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function ViolationCard({ violation }: { violation: AccessibilityViolation }) {
  const hasNodes = violation.nodes && violation.nodes.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold ${IMPACT_COLORS[violation.impact] ?? IMPACT_COLORS.minor}`}
          >
            {violation.impact}
          </span>
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
            {violation.id}
          </code>
        </div>
        <a
          href={violation.helpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Docs
          <ExternalLinkIcon className="h-3 w-3" />
        </a>
      </div>

      {/* Help + description */}
      <div className="space-y-1">
        <p className="text-sm font-medium">{violation.help}</p>
        {violation.description && (
          <p className="text-xs text-muted-foreground">{violation.description}</p>
        )}
      </div>

      {/* Affected elements */}
      {hasNodes && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Affected elements ({violation.nodes.length})
          </p>
          <div className="space-y-2">
            {violation.nodes.map((node, i) => (
              <div key={i} className="rounded border border-border bg-muted/40 p-2 space-y-1.5">
                {/* HTML snippet */}
                <div className="flex items-start gap-1">
                  <pre className="flex-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-foreground">
                    {node.html}
                  </pre>
                  <CopyButton text={node.html} />
                </div>

                {/* CSS selectors */}
                {node.target && node.target.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground shrink-0">Selector:</span>
                    <code className="flex-1 truncate font-mono text-xs text-foreground">
                      {node.target.join(' > ')}
                    </code>
                    <CopyButton text={node.target.join(' > ')} />
                  </div>
                )}

                {/* Failure summary */}
                {node.failureSummary && (
                  <p className="text-xs text-muted-foreground">{node.failureSummary}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback: no nodes stored (old visits) */}
      {!hasNodes && violation.nodeCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {violation.nodeCount} element{violation.nodeCount !== 1 ? 's' : ''} affected (node details
          available from new visits only)
        </p>
      )}
    </div>
  );
}

interface Props {
  urlData: UrlAccessibilitySummary | null;
  onClose: () => void;
}

export function AccessibilityDetailModal({ urlData, onClose }: Props) {
  const [filter, setFilter] = useState<ImpactFilter>('all');

  const violations = urlData?.latestViolations ?? [];

  const counts = {
    all: violations.length,
    critical: violations.filter((v) => v.impact === 'critical').length,
    serious: violations.filter((v) => v.impact === 'serious').length,
    moderate: violations.filter((v) => v.impact === 'moderate').length,
    minor: violations.filter((v) => v.impact === 'minor').length,
  };

  const filtered = violations
    .filter((v) => filter === 'all' || v.impact === filter)
    .sort((a, b) => (IMPACT_ORDER[a.impact] ?? 9) - (IMPACT_ORDER[b.impact] ?? 9));

  const filters: ImpactFilter[] = ['all', 'critical', 'serious', 'moderate', 'minor'];

  return (
    <Dialog
      open={urlData !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="pr-8">Accessibility violations</DialogTitle>
          <DialogDescription className="font-mono text-xs truncate">
            {urlData?.url}
          </DialogDescription>
        </DialogHeader>

        {/* Impact filter */}
        <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
          {filters.map((f) => {
            const count = counts[f];
            const isActive = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                disabled={count === 0 && f !== 'all'}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  isActive
                    ? f === 'all'
                      ? 'bg-foreground text-background'
                      : `${IMPACT_COLORS[f]} opacity-100`
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                    isActive && f !== 'all' ? 'bg-black/20' : 'bg-foreground/10'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Violation list */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No {filter === 'all' ? '' : `${filter} `}violations
            </p>
          ) : (
            filtered.map((v) => <ViolationCard key={v.id} violation={v} />)
          )}
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
