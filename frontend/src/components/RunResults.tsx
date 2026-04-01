export function RunResults({
  successCount,
  failureCount,
}: {
  successCount: number | null;
  failureCount: number | null;
}) {
  if (successCount === null) return <span>—</span>;
  return (
    <span>
      <span className="text-green-500">{successCount} ok</span>
      {failureCount ? <span className="ml-2 text-destructive">{failureCount} failed</span> : null}
    </span>
  );
}
