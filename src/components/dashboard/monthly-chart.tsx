"use client";

import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/simulador/deduction-rules";

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

interface MonthlyChartProps {
  monthCategoryData: MonthCategoryEntry[];
  fiscalYear: number;
}

function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function MonthlyChart({ monthCategoryData, fiscalYear }: MonthlyChartProps) {
  const now = new Date();
  const lastMonthToShow = fiscalYear === now.getFullYear() ? now.getMonth() + 1 : 12;

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

      <div className="relative mt-6" style={{ height: 220 }}>
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
                        hoverSegment?.month === m.month && hoverSegment.category !== seg.category;
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
                                  {CATEGORY_LABELS[s.category as keyof typeof CATEGORY_LABELS] ??
                                    s.category}
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
                hoverMonth === mi + 1 ? "text-foreground font-semibold" : "text-muted-foreground",
              )}
            >
              {name}
            </span>
          ))}
        </div>
      </div>

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
      `}</style>
    </div>
  );
}
