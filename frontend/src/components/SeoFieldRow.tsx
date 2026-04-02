export function SeoFieldRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-3 py-1 text-xs border-b border-border last:border-0">
      <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
      <span className={value ? 'font-mono break-all' : 'italic text-muted-foreground'}>
        {value ?? 'not set'}
      </span>
    </div>
  );
}