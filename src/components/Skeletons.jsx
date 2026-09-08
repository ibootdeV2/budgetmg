import { Skeleton } from "@/components/ui/skeleton";

/** Lignes de tableau grisées, pendant le chargement (Transactions, Budget). */
export function TableSkeleton({ rows = 6, columns = 4 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-t border-border">
          {Array.from({ length: columns }).map((__, c) => (
            <td key={c} className="px-4 py-3">
              <Skeleton className="h-4 w-full max-w-[140px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Cartes grisées, pendant le chargement (Objectifs, grilles de KPI). */
export function CardSkeleton({ count = 3, className = "" }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-2xl border border-border p-5 shadow-warm-sm space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Grille de KPI grisée (Dashboard). */
export function KpiSkeleton({ count = 5 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-2xl border border-border p-4 shadow-warm-sm space-y-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      ))}
    </div>
  );
}
