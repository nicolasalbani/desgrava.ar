"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Hourglass, CheckCheck, CreditCard, Crown, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ProximoPasoCard } from "./proximo-paso-card";
import { ComprobantesRecientes } from "./comprobantes-recientes";
import { CATEGORY_LABELS } from "@/lib/simulador/deduction-rules";

const DASHBOARD_RELEVANT_JOB_TYPES = new Set([
  "PULL_COMPROBANTES",
  "PULL_DOMESTIC_WORKERS",
  "PULL_DOMESTIC_RECEIPTS",
  "SUBMIT_INVOICE",
  "SUBMIT_DOMESTIC_DEDUCTION",
]);

const MONTH_NAMES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

// Categories map to design-system chart tokens (--chart-1 through --chart-10).
// The 10 most commonly-used categories get unique slots; the remaining 5
// cycle the palette, paired with categories they rarely co-occur with.
const CATEGORY_COLORS: Record<string, string> = {
  ALQUILER_VIVIENDA: "var(--chart-1)",
  GASTOS_MEDICOS: "var(--chart-2)",
  SERVICIO_DOMESTICO: "var(--chart-3)",
  CUOTAS_MEDICO_ASISTENCIALES: "var(--chart-4)",
  DONACIONES: "var(--chart-5)",
  GASTOS_EDUCATIVOS: "var(--chart-6)",
  INTERESES_HIPOTECARIOS: "var(--chart-7)",
  GASTOS_INDUMENTARIA_TRABAJO: "var(--chart-8)",
  PRIMAS_SEGURO_MUERTE: "var(--chart-9)",
  APORTES_RETIRO_PRIVADO: "var(--chart-10)",
  PRIMAS_AHORRO_SEGUROS_MIXTOS: "var(--chart-1)",
  APORTE_SGR: "var(--chart-2)",
  VEHICULOS_CORREDORES: "var(--chart-3)",
  INTERESES_CORREDORES: "var(--chart-4)",
  GASTOS_SEPELIO: "var(--chart-5)",
  OTRAS_DEDUCCIONES: "var(--muted-foreground)",
};

interface MonthCategoryEntry {
  month: number;
  category: string;
  amount: number;
}

interface SubscriptionInfo {
  plan: string;
  status: string;
  trialEndDate: string | null;
  currentPeriodEnd: string | null;
}

interface RecentInvoice {
  id: string;
  providerName: string | null;
  providerCuit: string;
  deductionCategory: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  amount: number;
  siradiqStatus: string;
}

interface MetricsPanelProps {
  firstName: string;
  fiscalYear: number;
  totalDeducted: number;
  estimatedSavings: number;
  totalInvoices: number;
  submittedCount: number;
  pendingCount: number;
  pendingInvoiceCount: number;
  pendingReceiptCount: number;
  totalDeducibleInvoices: number;
  totalDeducibleReceipts: number;
  hasUnregisteredWorker: boolean;
  monthCategoryData: MonthCategoryEntry[];
  recentInvoices: RecentInvoice[];
  allSubmitted: boolean;
  subscription: SubscriptionInfo | null;
}

function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function MetricsPanel({
  firstName,
  fiscalYear,
  totalDeducted,
  estimatedSavings,
  totalInvoices,
  submittedCount,
  pendingCount,
  pendingInvoiceCount,
  pendingReceiptCount,
  totalDeducibleInvoices,
  totalDeducibleReceipts,
  hasUnregisteredWorker,
  monthCategoryData,
  recentInvoices,
  allSubmitted,
  subscription,
}: MetricsPanelProps) {
  // Auto-refresh when relevant automation jobs complete
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    let hadActiveJobs = false;

    async function checkJobs() {
      try {
        const res = await fetch("/api/automatizacion");
        if (!res.ok || cancelled) return;
        const { jobs } = await res.json();

        const hasActive = jobs.some(
          (j: { jobType: string; status: string }) =>
            DASHBOARD_RELEVANT_JOB_TYPES.has(j.jobType) &&
            (j.status === "PENDING" || j.status === "RUNNING"),
        );

        if (hasActive) {
          hadActiveJobs = true;
          if (!interval) {
            interval = setInterval(checkJobs, 4000);
          }
        } else if (hadActiveJobs) {
          hadActiveJobs = false;
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
          router.refresh();
        }
      } catch {
        // Silently ignore fetch errors
      }
    }

    checkJobs();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animation key — bumped on data changes to replay the bar-grow animation
  const [animKey] = useState(0);

  // Bars run up to the current month for the current fiscal year, full year otherwise.
  const now = new Date();
  const lastMonthToShow = fiscalYear === now.getFullYear() ? now.getMonth() + 1 : 12;

  // Categories with any data, sorted by total descending — this is the legend order.
  const availableCategories = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of monthCategoryData) {
      if (e.amount > 0) totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);
  }, [monthCategoryData]);

  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

  // Drop hidden entries that no longer exist when data changes.
  useEffect(() => {
    setHiddenCategories((prev) => {
      const valid = new Set(availableCategories);
      const next = new Set<string>();
      for (const cat of prev) if (valid.has(cat)) next.add(cat);
      return next.size === prev.size ? prev : next;
    });
  }, [availableCategories]);

  const visibleCategories = useMemo(
    () => availableCategories.filter((c) => !hiddenCategories.has(c)),
    [availableCategories, hiddenCategories],
  );

  // Per-month breakdown of visible categories, stacked from bottom up by legend order.
  const monthlyBreakdown = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      if (month > lastMonthToShow) {
        return { month, segments: [] as { category: string; amount: number }[], total: 0 };
      }
      const segments = visibleCategories
        .map((category) => ({
          category,
          amount:
            monthCategoryData.find((e) => e.month === month && e.category === category)?.amount ??
            0,
        }))
        .filter((s) => s.amount > 0);
      const total = segments.reduce((sum, s) => sum + s.amount, 0);
      return { month, segments, total };
    });
  }, [monthCategoryData, visibleCategories, lastMonthToShow]);

  const monthlyMax = Math.max(...monthlyBreakdown.map((m) => m.total), 1);

  const visibleTotal = useMemo(
    () => monthlyBreakdown.reduce((sum, m) => sum + m.total, 0),
    [monthlyBreakdown],
  );

  const chartSubtitle =
    hiddenCategories.size === 0
      ? `Todas las categorías · año fiscal ${fiscalYear}`
      : `${visibleCategories.length} de ${availableCategories.length} categorías · año fiscal ${fiscalYear}`;

  const [hoverMonth, setHoverMonth] = useState<number | null>(null);
  const [hoverSegment, setHoverSegment] = useState<{ month: number; category: string } | null>(
    null,
  );

  function toggleCategory(cat: string) {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-in fade-in duration-500" style={{ animationFillMode: "backwards" }}>
        <p className="text-muted-foreground text-sm">
          Hola, {firstName} <span aria-hidden="true">👋</span>
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Resumen de deducciones — Año fiscal {fiscalYear}
        </h1>
      </div>

      {/* Top metric cards */}
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

      {/* Chart + Próximo paso side-by-side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Monthly stacked-by-category bar chart */}
        <div
          className="animate-in fade-in slide-in-from-bottom-2 bg-card border-border rounded-2xl border p-5 duration-500 lg:col-span-2"
          style={{ animationDelay: "200ms", animationFillMode: "backwards" }}
        >
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider">
            RESUMEN POR MES
          </p>
          <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">
            {formatARS(visibleTotal)}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">{chartSubtitle}</p>

          {availableCategories.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {availableCategories.map((cat) => {
                const hidden = hiddenCategories.has(cat);
                const color = CATEGORY_COLORS[cat] ?? "var(--muted-foreground)";
                const label = CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    aria-pressed={!hidden}
                    title={label}
                    className={cn(
                      "inline-flex max-w-[260px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                      hidden
                        ? "border-border bg-muted/30 text-muted-foreground/60"
                        : "border-border bg-card hover:bg-muted/50",
                    )}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full transition-opacity"
                      style={{ backgroundColor: color, opacity: hidden ? 0.3 : 1 }}
                    />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="relative mt-6" style={{ height: 220 }} key={animKey}>
            <div className="absolute inset-x-0 top-0" style={{ height: 180 }}>
              <div className="flex h-full items-end gap-2 sm:gap-3">
                {monthlyBreakdown.map((m, mi) => {
                  const barPct = monthlyMax > 0 ? (m.total / monthlyMax) * 100 : 0;
                  const showRight = mi < 6;
                  const isActive = hoverMonth === m.month && m.total > 0;
                  const segHover =
                    hoverSegment?.month === m.month
                      ? m.segments.find((s) => s.category === hoverSegment.category)
                      : undefined;
                  return (
                    <div
                      key={m.month}
                      className="relative flex h-full flex-1 items-end"
                      onMouseEnter={() => setHoverMonth(m.month)}
                      onMouseLeave={() => {
                        setHoverMonth(null);
                        setHoverSegment(null);
                      }}
                    >
                      <div
                        className={cn(
                          "relative flex w-full flex-col-reverse overflow-hidden rounded-t-xl transition-shadow",
                          isActive && "ring-primary/30 ring-2",
                        )}
                        style={{
                          height: `${barPct}%`,
                          minHeight: m.total > 0 ? 4 : 0,
                          opacity: 0,
                          animation: `barGrow 500ms ${60 * mi}ms cubic-bezier(0.34,1.56,0.64,1) forwards`,
                        }}
                      >
                        {m.segments.map((seg) => {
                          const segPct = m.total > 0 ? (seg.amount / m.total) * 100 : 0;
                          const dimmed =
                            hoverSegment?.month === m.month &&
                            hoverSegment.category !== seg.category;
                          return (
                            <div
                              key={seg.category}
                              className="w-full transition-opacity"
                              style={{
                                height: `${segPct}%`,
                                backgroundColor:
                                  CATEGORY_COLORS[seg.category] ?? "var(--muted-foreground)",
                                opacity: dimmed ? 0.4 : 1,
                              }}
                              onMouseEnter={(e) => {
                                e.stopPropagation();
                                setHoverSegment({ month: m.month, category: seg.category });
                              }}
                            />
                          );
                        })}
                      </div>

                      {/* Per-segment inline label */}
                      {segHover && (
                        <div
                          className="bg-foreground text-background pointer-events-none absolute z-10 max-w-[240px] rounded-md px-2 py-1 text-xs leading-snug shadow-md"
                          style={{
                            bottom: `calc(${barPct}% + 8px)`,
                            ...(showRight
                              ? { left: "100%", marginLeft: 8 }
                              : { right: "100%", marginRight: 8 }),
                          }}
                        >
                          <span className="font-medium">
                            {CATEGORY_LABELS[segHover.category as keyof typeof CATEGORY_LABELS] ??
                              segHover.category}
                          </span>
                          : {formatARS(segHover.amount)}
                        </div>
                      )}

                      {/* Per-month tooltip card */}
                      {isActive && (
                        <div
                          className="border-border bg-card pointer-events-none absolute top-0 z-20 w-[280px] rounded-xl border p-3 shadow-lg"
                          style={{
                            ...(showRight
                              ? { left: "100%", marginLeft: 12 }
                              : { right: "100%", marginRight: 12 }),
                          }}
                        >
                          <div className="text-foreground mb-2 text-sm font-semibold">
                            {MONTH_NAMES[m.month - 1]} · {formatARS(m.total)}
                          </div>
                          <div className="space-y-1.5">
                            {[...m.segments]
                              .sort((a, b) => b.amount - a.amount)
                              .map((s) => (
                                <div
                                  key={s.category}
                                  className="flex items-start justify-between gap-3 text-xs"
                                >
                                  <span className="flex min-w-0 items-start gap-2">
                                    <span
                                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                                      style={{
                                        backgroundColor:
                                          CATEGORY_COLORS[s.category] ?? "var(--muted-foreground)",
                                      }}
                                    />
                                    <span className="text-muted-foreground leading-snug">
                                      {CATEGORY_LABELS[
                                        s.category as keyof typeof CATEGORY_LABELS
                                      ] ?? s.category}
                                    </span>
                                  </span>
                                  <span className="text-foreground shrink-0 tabular-nums">
                                    {formatARS(s.amount)}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="absolute right-0 bottom-0 left-0 flex gap-2 sm:gap-3">
              {MONTH_NAMES.map((name, mi) => (
                <span
                  key={name}
                  className={cn(
                    "flex-1 text-center text-xs",
                    hoverMonth === mi + 1
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground",
                  )}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Próximo paso card */}
        <ProximoPasoCard
          pendingInvoiceCount={pendingInvoiceCount}
          pendingReceiptCount={pendingReceiptCount}
          totalDeducibleInvoices={totalDeducibleInvoices}
          totalDeducibleReceipts={totalDeducibleReceipts}
          hasUnregisteredWorker={hasUnregisteredWorker}
          allSubmitted={allSubmitted}
          fiscalYear={fiscalYear}
        />
      </div>

      {/* Comprobantes recientes */}
      <ComprobantesRecientes invoices={recentInvoices} totalCount={totalInvoices} />

      {/* Subscription card */}
      <div
        className="animate-in fade-in slide-in-from-bottom-2 bg-card border-border rounded-2xl border p-5 duration-500"
        style={{ animationDelay: "300ms", animationFillMode: "backwards" }}
      >
        <h2 className="mb-3 text-sm font-semibold">Tu plan</h2>
        {subscription ? (
          <SubscriptionCard subscription={subscription} />
        ) : (
          <div className="flex items-center gap-3">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <p className="text-muted-foreground text-sm">Sin suscripción activa</p>
            <Button asChild size="sm" className="ml-auto">
              <Link href="/configuracion">Suscribirse</Link>
            </Button>
          </div>
        )}
      </div>

      {/* CSS animation keyframes */}
      <style jsx>{`
        @keyframes barGrow {
          0% {
            opacity: 0;
            transform: scaleY(0);
            transform-origin: bottom;
          }
          60% {
            opacity: 1;
          }
          100% {
            opacity: 1;
            transform: scaleY(1);
            transform-origin: bottom;
          }
        }
        @keyframes dotFadeIn {
          to {
            opacity: 1;
          }
        }
      `}</style>
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

function SubscriptionCard({ subscription }: { subscription: SubscriptionInfo }) {
  const { plan, status, trialEndDate, currentPeriodEnd } = subscription;
  const planLabel = plan === "FOUNDERS" ? "Founders" : "Personal";

  if (plan === "FOUNDERS") {
    return (
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
          <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-medium">{planLabel}</p>
          <p className="text-muted-foreground text-xs">Acceso permanente</p>
        </div>
      </div>
    );
  }

  if (status === "TRIALING" && trialEndDate) {
    const days = daysUntil(trialEndDate);
    return (
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-xl">
          <CreditCard className="text-primary h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium">{planLabel} — Prueba gratuita</p>
          <p className="text-muted-foreground text-xs">
            {days > 0
              ? `${days} día${days !== 1 ? "s" : ""} restante${days !== 1 ? "s" : ""} (vence ${formatDate(trialEndDate)})`
              : `Vencida el ${formatDate(trialEndDate)}`}
          </p>
        </div>
      </div>
    );
  }

  if (status === "ACTIVE" && currentPeriodEnd) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
          <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium">{planLabel}</p>
          <p className="text-muted-foreground text-xs">
            Próximo cobro: {formatDate(currentPeriodEnd)}
          </p>
        </div>
      </div>
    );
  }

  if (status === "CANCELLED" && currentPeriodEnd) {
    return (
      <div className="flex items-center gap-3">
        <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-xl">
          <CreditCard className="text-muted-foreground h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium">{planLabel} — Cancelado</p>
          <p className="text-muted-foreground text-xs">
            Acceso hasta {formatDate(currentPeriodEnd)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <AlertCircle className="h-5 w-5 text-red-500" />
      <div className="flex-1">
        <p className="text-sm font-medium">{planLabel}</p>
        <p className="text-muted-foreground text-xs">
          {status === "PAST_DUE" ? "Pago pendiente" : "Suscripción vencida"}
        </p>
      </div>
      <Button asChild size="sm">
        <Link href="/configuracion">Renovar</Link>
      </Button>
    </div>
  );
}
