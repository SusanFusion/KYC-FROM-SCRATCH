import { Skeleton } from "@/components/shared/LoadingState";

export default function Loading() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <Skeleton className="h-8 w-64" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="mt-4 h-64 w-full" />
    </div>
  );
}
