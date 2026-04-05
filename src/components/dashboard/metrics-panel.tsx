"use client";

import { useState, useMemo, useEffect } from "react";
import { CATEGORY_LABELS } from "@/lib/simulador/deduction-rules";
import { TrendingUp, FileText, Send, Clock, CreditCard, Crown, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

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

// Softer category colors for stacking
const CATEGORY_COLORS: Record<string, string> = {
  CUOTAS_MEDICO_ASISTENCIALES: "bg-blue-400/80",
  PRIMAS_SEGURO_MUERTE: "bg-violet-400/80",
  PRIMAS_AHORRO_SEGUROS_MIXTOS: "bg-purple-400/80",
  APORTES_RETIRO_PRIVADO: "bg-indigo-400/80",
  DONACIONES: "bg-pink-400/80",
  INTERESES_HIPOTECARIOS: "bg-cyan-400/80",
  GASTOS_SEPELIO: "bg-slate-400/80",
  GASTOS_MEDICOS: "bg-teal-400/80",
  GASTOS_INDUMENTARIA_TRABAJO: "bg-orange-400/80",
  ALQUILER_VIVIENDA: "bg-amber-400/80",
  SERVICIO_DOMESTICO: "bg-lime-400/80",
  APORTE_SGR: "bg-emerald-400/80",
  VEHICULOS_CORREDORES: "bg-rose-400/80",
  INTERESES_CORREDORES: "bg-fuchsia-400/80",
  GASTOS_EDUCATIVOS: "bg-sky-400/80",
  OTRAS_DEDUCCIONES: "bg-stone-400/80",
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

interface MetricsPanelProps {
  firstName: string;
  fiscalYear: number;
  totalDeducted: number;
  estimatedSavings: number;
  totalInvoices: number;
  submittedCount: number;
  pendingCount: number;
  monthCategoryData: MonthCategoryEntry[];
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

function shortLabel(category: string): string {
  const full = CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category;
  if (full.length > 35) return full.slice(0, 32) + "...";
  return full;
}

export function MetricsPanel({
  firstName,
  fiscalYear,
  totalDeducted,
  estimatedSavings,
  totalInvoices,
  submittedCount,
  pendingCount,
  monthCategoryData,
  subscription,
}: MetricsPanelProps) {
  const hasData = totalInvoices > 0;

  // Derive unique categories with totals
  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of monthCategoryData) {
      map.set(entry.category, (map.get(entry.category) ?? 0) + entry.amount);
    }
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthCategoryData]);

  // Category filter state — all enabled by default
  const [enabledCategories, setEnabledCategories] = useState<Set<string>>(
    () => new Set(categoryTotals.map((c) => c.category)),
  );

  // Stable key for the set of available categories — only changes when categories actually change
  const categoryKeys = useMemo(
    () =>
      categoryTotals
        .map((c) => c.category)
        .sort()
        .join(","),
    [categoryTotals],
  );

  // Sync enabled categories when available categories change (e.g. after onboarding refresh)
  useEffect(() => {
    setEnabledCategories(new Set(categoryTotals.map((c) => c.category)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryKeys]);

  // Toggling a filter triggers a new animation via a key
  const [animKey, setAnimKey] = useState(0);

  // Show/hide cumulative line
  const [showCumulativeLine, setShowCumulativeLine] = useState(true);

  function toggleCategory(cat: string) {
    setEnabledCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        // Don't allow disabling all
        if (next.size === 1) return prev;
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
    setAnimKey((k) => k + 1);
  }

  // Build stacked bar data per month, filtered by enabled categories
  const stackedMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const segments = categoryTotals
        .filter((ct) => enabledCategories.has(ct.category))
        .map((ct) => {
          const entry = monthCategoryData.find(
            (e) => e.month === month && e.category === ct.category,
          );
          return { category: ct.category, amount: entry?.amount ?? 0 };
        })
        .filter((s) => s.amount > 0);
      const total = segments.reduce((sum, s) => sum + s.amount, 0);
      return { month, segments, total };
    });
  }, [monthCategoryData, categoryTotals, enabledCategories]);

  // Current month (1-indexed) — months up to this are actual, rest are projected
  const currentMonth = new Date().getMonth() + 1;

  // Cumulative totals with projection for future months
  const { cumulativeMonths, projectedStartIndex } = useMemo(() => {
    // Calculate average monthly deduction from months that have data
    const monthsWithData = stackedMonths.filter((m) => m.month <= currentMonth && m.total > 0);
    const avgMonthly =
      monthsWithData.length > 0
        ? monthsWithData.reduce((sum, m) => sum + m.total, 0) / monthsWithData.length
        : 0;

    let running = 0;
    const cumulative = stackedMonths.map((m) => {
      if (m.month <= currentMonth) {
        running += m.total;
      } else {
        // Project future months using average
        running += avgMonthly;
      }
      return running;
    });

    return {
      cumulativeMonths: cumulative,
      projectedStartIndex: currentMonth - 1, // 0-based index of last actual month
    };
  }, [stackedMonths, currentMonth]);

  const maxCumulative = Math.max(...cumulativeMonths, 1);

  // Scale to actual cumulative (through current month) — no projections needed
  const chartMax = Math.max(cumulativeMonths[currentMonth - 1] ?? 1, 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-in fade-in duration-500" style={{ animationFillMode: "backwards" }}>
        <h1 className="text-2xl font-semibold tracking-tight">Hola, {firstName}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Resumen de deducciones — Año fiscal {fiscalYear}
        </p>
      </div>

      {/* Top metric cards */}
      <div
        className="animate-in fade-in slide-in-from-bottom-2 grid grid-cols-1 gap-4 duration-500 sm:grid-cols-2 lg:grid-cols-3"
        style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
      >
        <div className="bg-card border-border rounded-2xl border p-5">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-xl">
              <TrendingUp className="text-primary h-5 w-5" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Total deducido</p>
              <p className="text-xl font-semibold tabular-nums">{formatARS(totalDeducted)}</p>
            </div>
          </div>
        </div>

        <div className="bg-card border-border rounded-2xl border p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Ahorro estimado</p>
              <p className="text-xl font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                {formatARS(estimatedSavings)}
              </p>
            </div>
          </div>
          <p className="text-muted-foreground/60 mt-2 text-[10px]">
            Basado en la alícuota máxima (35%)
          </p>
        </div>

        <div className="bg-card border-border rounded-2xl border p-5">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-xl">
              <FileText className="text-primary h-5 w-5" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Comprobantes</p>
              <p className="text-xl font-semibold tabular-nums">{totalInvoices}</p>
            </div>
          </div>
          <div className="text-muted-foreground mt-3 flex gap-4 text-xs">
            <span className="flex items-center gap-1">
              <Send className="h-3 w-3 text-emerald-500" />
              {submittedCount} enviados
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-amber-500" />
              {pendingCount} pendientes
            </span>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!hasData && (
        <div
          className="animate-in fade-in slide-in-from-bottom-2 bg-card border-border rounded-2xl border p-8 text-center duration-500"
          style={{ animationDelay: "200ms", animationFillMode: "backwards" }}
        >
          <FileText className="text-muted-foreground/30 mx-auto mb-3 h-8 w-8" />
          <p className="text-muted-foreground text-sm">
            Todavía no tenés comprobantes deducidos. Importalos desde ARCA o subí un PDF.
          </p>
          <Button asChild variant="outline" className="mt-4" size="sm">
            <Link href="/facturas">Ir a comprobantes</Link>
          </Button>
        </div>
      )}

      {/* Stacked bar chart + category legend */}
      {hasData && categoryTotals.length > 0 && (
        <div
          className="animate-in fade-in slide-in-from-bottom-2 bg-card border-border rounded-2xl border p-5 duration-500"
          style={{ animationDelay: "200ms", animationFillMode: "backwards" }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Evolución mensual por categoría</h2>
            <button
              onClick={() => setShowCumulativeLine((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] transition-all duration-200",
                showCumulativeLine
                  ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "border-border text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "inline-block h-1.5 w-3 rounded-full",
                  showCumulativeLine ? "bg-emerald-500" : "bg-muted-foreground/30",
                )}
              />
              Acumulado
            </button>
          </div>

          {/* Stacked bar chart with cumulative line overlay */}
          <div className="relative" style={{ height: 200 }} key={animKey}>
            {/* Chart area — bars, line, and dots share this exact 160px space */}
            <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: 160 }}>
              {/* Bars */}
              <div className="flex h-full items-end gap-1.5 sm:gap-2">
                {stackedMonths.map((m, mi) => {
                  const barPct = chartMax > 0 ? (m.total / chartMax) * 100 : 0;
                  return (
                    <div key={m.month} className="relative flex h-full flex-1 items-end">
                      <div
                        className="flex w-full flex-col justify-end overflow-hidden rounded-t-lg"
                        style={{
                          height: `${barPct}%`,
                          minHeight: m.total > 0 ? 4 : 0,
                          opacity: 0,
                          animation: `barGrow 500ms ${80 * mi}ms cubic-bezier(0.34,1.56,0.64,1) forwards`,
                        }}
                      >
                        {m.segments.map((seg) => {
                          const segPct = m.total > 0 ? (seg.amount / m.total) * 100 : 0;
                          return (
                            <div
                              key={seg.category}
                              className={cn(
                                "w-full shrink-0",
                                CATEGORY_COLORS[seg.category] ?? "bg-primary",
                              )}
                              style={{ height: `${segPct}%`, minHeight: 2 }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Cumulative line overlay — actual months only */}
              {showCumulativeLine &&
                (() => {
                  const padding = 5;
                  const usable = 100 - padding;

                  const ptsData = cumulativeMonths
                    .map((cum, i) => ({
                      xPct: ((i + 0.5) / 12) * 100,
                      yPct: chartMax > 0 ? padding + usable * (1 - cum / chartMax) : 100,
                      cum,
                      month: MONTH_NAMES[i],
                    }))
                    .filter((_, i) => i <= projectedStartIndex);

                  return (
                    <>
                      {/* SVG line segments */}
                      <svg
                        className="pointer-events-none absolute inset-0"
                        width="100%"
                        height="100%"
                      >
                        {ptsData.length > 1 &&
                          ptsData.map((p, i) => {
                            if (i === 0) return null;
                            const prev = ptsData[i - 1];
                            return (
                              <line
                                key={`actual-${i}`}
                                x1={`${prev.xPct}%`}
                                y1={`${prev.yPct}%`}
                                x2={`${p.xPct}%`}
                                y2={`${p.yPct}%`}
                                stroke="rgb(34 197 94)"
                                strokeWidth={2}
                                strokeLinecap="round"
                                style={{
                                  opacity: 0,
                                  animation: `dotFadeIn 300ms ${400 + i * 100}ms ease-out forwards`,
                                }}
                              />
                            );
                          })}
                      </svg>

                      {/* Interactive HTML dots with tooltips */}
                      <div className="absolute inset-0">
                        {ptsData.map((p, i) => {
                          if (p.cum === 0) return null;
                          return (
                            <div
                              key={i}
                              className="group absolute -translate-x-1/2 -translate-y-1/2"
                              style={{ left: `${p.xPct}%`, top: `${p.yPct}%` }}
                            >
                              <div className="flex h-6 w-6 items-center justify-center">
                                <div
                                  className="h-2 w-2 rounded-full bg-emerald-500"
                                  style={{
                                    opacity: 0,
                                    animation: `dotFadeIn 200ms ${600 + i * 60}ms ease-out forwards`,
                                  }}
                                />
                              </div>
                              <div className="bg-foreground text-background pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 rounded-md px-2 py-1 text-[10px] whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100">
                                <span className="font-medium tabular-nums">{formatARS(p.cum)}</span>
                                <span className="ml-1 opacity-60">{p.month}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {ptsData.length > 0 && ptsData[ptsData.length - 1].cum > 0 && (
                        <div className="absolute top-0 right-0 flex items-center gap-1 text-[10px] text-emerald-500/70 tabular-nums">
                          <span className="text-muted-foreground/40">acumulado</span>
                          {formatARS(ptsData[ptsData.length - 1].cum)}
                        </div>
                      )}
                    </>
                  );
                })()}
            </div>

            {/* Month labels */}
            <div className="absolute right-0 bottom-0 left-0 flex gap-1.5 sm:gap-2">
              {MONTH_NAMES.map((name) => (
                <span key={name} className="text-muted-foreground flex-1 text-center text-[10px]">
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* Category legend / filters */}
          <div className="flex flex-wrap gap-2">
            {categoryTotals.map((ct) => {
              const enabled = enabledCategories.has(ct.category);
              const colorClass = CATEGORY_COLORS[ct.category] ?? "bg-primary";
              return (
                <button
                  key={ct.category}
                  onClick={() => toggleCategory(ct.category)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all duration-200",
                    enabled
                      ? "border-border bg-card text-foreground"
                      : "text-muted-foreground/40 border-transparent bg-transparent",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-2 w-2 rounded-full",
                      colorClass,
                      !enabled && "opacity-30",
                    )}
                  />
                  <span className="max-w-[120px] truncate sm:max-w-[200px]">
                    {shortLabel(ct.category)}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{formatARS(ct.amount)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

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
