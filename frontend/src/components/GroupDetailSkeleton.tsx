import { Card, CardContent } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

export function GroupDetailSkeleton() {
  return (
    <div>
      <Skeleton className="mb-1 h-4 w-28" />
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Skeleton className="mb-1.5 h-7 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="mb-1.5 h-3 w-16" />
              <Skeleton className="h-6 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="mb-4 h-10 w-80" />
      <div className="rounded-lg border border-border">
        <div className="p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={String(i)} className="mb-2 h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}