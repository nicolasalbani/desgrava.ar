import { TrendingUp, Hourglass, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricsRowProps {
  totalDeducted: number;
  totalInvoices: number;
  estimatedSavings: number;
  pendingCount: number;
  submittedCount: number;
}

function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function MetricsRow({
  totalDeducted,
  totalInvoices,
  estimatedSavings,
  pendingCount,
  submittedCount,
}: MetricsRowProps) {
  return (
    <div
      data-tour="metrics-row"
      className="animate-in fade-in slide-in-from-bottom-2 grid grid-cols-1 gap-4 duration-500 sm:grid-cols-2 lg:grid-cols-4"
      style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
    >
      <MetricCard
        icon={<TrendingUp className="text-primary h-5 w-5" />}
        iconBgClass="bg-primary/10"
        eyebrow="TOTAL DEDUCIDO"
        value={formatARS(totalDeducted)}
        subtitle={`${totalInvoices} ${totalInvoices === 1 ? "comprobante" : "comprobantes"}`}
      />

      <MetricCard
        icon={<TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
        iconBgClass="bg-emerald-500/10"
        eyebrow="AHORRO ESTIMADO"
        value={formatARS(estimatedSavings)}
        valueClass="text-emerald-600 dark:text-emerald-400"
        subtitle="alícuota máxima (35%)"
        highlight
      />

      <MetricCard
        icon={<Hourglass className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
        iconBgClass="bg-amber-500/10"
        eyebrow="PENDIENTES"
        value={String(pendingCount)}
        subtitle="esperando validación"
      />

      <MetricCard
        icon={<CheckCheck className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
        iconBgClass="bg-violet-500/10"
        eyebrow="PRESENTADAS"
        value={String(submittedCount)}
        subtitle="al formulario F.572"
      />
    </div>
  );
}

function MetricCard({
  icon,
  iconBgClass,
  eyebrow,
  value,
  valueClass,
  subtitle,
  highlight = false,
}: {
  icon: React.ReactNode;
  iconBgClass: string;
  eyebrow: string;
  value: string;
  valueClass?: string;
  subtitle: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-card rounded-2xl border p-5 transition-colors",
        highlight ? "border-emerald-500/30" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            iconBgClass,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider">
            {eyebrow}
          </p>
          <p className={cn("text-xl font-semibold tabular-nums", valueClass)}>{value}</p>
        </div>
      </div>
      <p className="text-muted-foreground/70 mt-3 text-xs">{subtitle}</p>
    </div>
  );
}
