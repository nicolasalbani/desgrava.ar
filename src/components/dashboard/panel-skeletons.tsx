/**
 * Suspense fallback skeletons for the `/panel` streamed sections.
 *
 * Each skeleton's outer dimensions match the final rendered section to
 * within ~8px so hydration doesn't cause cumulative layout shift.
 */

export function MetricsRowSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      aria-busy="true"
      aria-label="Cargando métricas"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-card border-border h-[122px] rounded-2xl border p-5">
          <div className="flex items-start gap-3">
            <div className="bg-muted h-10 w-10 shrink-0 animate-pulse rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="bg-muted h-3 w-24 animate-pulse rounded" />
              <div className="bg-muted h-6 w-20 animate-pulse rounded" />
            </div>
          </div>
          <div className="bg-muted mt-3 h-3 w-32 animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}

export function MonthlyChartSkeleton() {
  return (
    <div
      className="bg-card border-border h-[372px] rounded-2xl border p-5 lg:col-span-2"
      aria-busy="true"
      aria-label="Cargando gráfico mensual"
    >
      <div className="bg-muted h-3 w-32 animate-pulse rounded" />
      <div className="bg-muted mt-2 h-7 w-40 animate-pulse rounded" />
      <div className="bg-muted mt-1 h-3 w-48 animate-pulse rounded" />
      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-muted h-6 w-20 animate-pulse rounded-full" />
        ))}
      </div>
      <div className="mt-6 flex items-end gap-2 sm:gap-3" style={{ height: 180 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="bg-muted flex-1 animate-pulse rounded-t-xl"
            style={{ height: `${30 + ((i * 17) % 60)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ProximoPasoSkeleton() {
  return (
    <div
      className="bg-card border-border h-[372px] rounded-2xl border p-5"
      aria-busy="true"
      aria-label="Cargando próximo paso"
    >
      <div className="bg-muted h-3 w-24 animate-pulse rounded" />
      <div className="bg-muted mt-2 h-5 w-40 animate-pulse rounded" />
      <div className="bg-muted mt-3 h-3 w-full animate-pulse rounded" />
      <div className="bg-muted mt-2 h-3 w-3/4 animate-pulse rounded" />
      <div className="bg-muted mt-6 h-9 w-32 animate-pulse rounded" />
    </div>
  );
}

export function RecentInvoicesSkeleton() {
  return (
    <div
      className="bg-card border-border min-h-[300px] rounded-2xl border p-5"
      aria-busy="true"
      aria-label="Cargando comprobantes recientes"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="bg-muted h-4 w-44 animate-pulse rounded" />
          <div className="bg-muted h-3 w-32 animate-pulse rounded" />
        </div>
        <div className="bg-muted h-8 w-36 animate-pulse rounded" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex-1 space-y-1">
              <div className="bg-muted h-3 w-3/5 animate-pulse rounded" />
              <div className="bg-muted h-3 w-2/5 animate-pulse rounded" />
            </div>
            <div className="bg-muted h-3 w-16 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SubscriptionCardSkeleton() {
  return (
    <div
      className="bg-card border-border h-[100px] rounded-2xl border p-5"
      aria-busy="true"
      aria-label="Cargando suscripción"
    >
      <div className="bg-muted h-4 w-16 animate-pulse rounded" />
      <div className="mt-3 flex items-center gap-3">
        <div className="bg-muted h-10 w-10 animate-pulse rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="bg-muted h-3 w-32 animate-pulse rounded" />
          <div className="bg-muted h-3 w-48 animate-pulse rounded" />
        </div>
      </div>
    </div>
  );
}
