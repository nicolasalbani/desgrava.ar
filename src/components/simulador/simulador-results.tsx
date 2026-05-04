"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, TrendingUp } from "lucide-react";
import { Home, HeartPulse, Stethoscope, GraduationCap, Key } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { SimplifiedSimulationResult } from "@/lib/simulador/calculator";
import { PERSONAL_PLAN_MONTHLY_COST } from "@/lib/simulador/calculator";
import { FISCAL_YEAR_DISPLAY } from "@/lib/simulador/tax-tables";
import {
  HUE_CLASSES,
  findConfigByCategory,
  type SimuladorCategoryConfig,
} from "@/lib/simulador/category-config";
import { cn } from "@/lib/utils";

const ICONS: Record<SimuladorCategoryConfig["key"], LucideIcon> = {
  alquiler: Home,
  prepaga: HeartPulse,
  salud: Stethoscope,
  educacion: GraduationCap,
  hipotecario: Key,
  domestico: Sparkles,
};

const TOP_RATE_PERCENT = 35;

function formatMoney(value: number): string {
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatCompactM(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `$${millions.toFixed(millions >= 10 ? 0 : 2)}M`;
  }
  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}k`;
  }
  return formatMoney(value);
}

function AnimatedNumber({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const duration = 400;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      setDisplayed(Math.round(current));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <>{formatMoney(displayed)}</>;
}

interface DerivedNumbers {
  grossAnnual: number;
  grossMonthly: number;
  netAnnual: number;
  planCostAnnual: number;
  roiMultiplier: number;
  hasGross: boolean;
  hasPositiveNet: boolean;
}

function deriveNumbers(result: SimplifiedSimulationResult): DerivedNumbers {
  const grossAnnual = parseFloat(result.ahorroAnualHasta);
  const grossMonthly = parseFloat(result.ahorroMensualHasta);
  const netAnnual = parseFloat(result.ahorronetoAnual);
  const planCostAnnual = PERSONAL_PLAN_MONTHLY_COST * 12;
  const roiMultiplier =
    PERSONAL_PLAN_MONTHLY_COST > 0 ? Math.floor(grossMonthly / PERSONAL_PLAN_MONTHLY_COST) : 0;
  return {
    grossAnnual,
    grossMonthly,
    netAnnual,
    planCostAnnual,
    roiMultiplier,
    hasGross: grossAnnual > 0,
    hasPositiveNet: netAnnual > 0,
  };
}

/* ───────────── Desktop sticky panel ───────────── */

export function SimuladorResults({ result }: { result: SimplifiedSimulationResult }) {
  const d = deriveNumbers(result);

  if (!d.hasGross) {
    return (
      <div className="border-border bg-card rounded-2xl border p-6">
        <p className="text-muted-foreground text-center text-sm">
          Movés un slider para ver tu devolución estimada.
        </p>
      </div>
    );
  }

  const breakdownRows = result.detalleDeduciones
    .map((row) => {
      const deductible = parseFloat(row.deductibleAmount);
      if (deductible <= 0) return null;
      const config = findConfigByCategory(row.category);
      const savings = deductible * 0.35;
      return { row, deductible, savings, config };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return (
    <div className="border-border bg-card rounded-2xl border p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-primary inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
          <Sparkles className="h-3.5 w-3.5" />
          Devolución estimada
        </p>
        <p className="text-muted-foreground text-xs tabular-nums">F.572 · {FISCAL_YEAR_DISPLAY}</p>
      </div>

      <p className="text-foreground mt-3 text-4xl leading-none font-bold tracking-tight tabular-nums md:text-5xl">
        <AnimatedNumber value={d.grossAnnual} />
      </p>

      <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="tabular-nums">≈ {formatMoney(d.grossMonthly)} por mes</span>
        {d.roiMultiplier > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-3 w-3" />
            {d.roiMultiplier}× el plan
          </span>
        )}
      </div>

      <div className="border-border mt-5 border-t pt-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          Desglose
        </p>
        <ul className="mt-3 space-y-3">
          {breakdownRows.map(({ row, deductible, savings, config }) => {
            const hue = config ? HUE_CLASSES[config.hue] : null;
            const Icon = config ? ICONS[config.key] : Sparkles;
            return (
              <li key={row.category} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      hue?.iconBg ?? "bg-muted",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", hue?.iconText ?? "text-muted-foreground")} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-medium">
                      {config?.label ?? row.label}
                    </p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      base {formatCompactM(deductible)} × {TOP_RATE_PERCENT}%
                    </p>
                  </div>
                </div>
                <span className="text-foreground shrink-0 text-sm font-medium tabular-nums">
                  +{formatMoney(savings)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-border mt-4 space-y-2 border-t pt-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Costo Plan Personal</span>
          <span className="text-foreground tabular-nums">−{formatMoney(d.planCostAnnual)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-foreground font-semibold">Ganancia neta anual</span>
          <span className="text-base font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
            <AnimatedNumber value={d.netAnnual} />
          </span>
        </div>
      </div>

      <Button asChild size="lg" className="mt-5 h-12 w-full text-base">
        <Link href="/login">
          Empezá a recuperar {formatMoney(Math.max(d.netAnnual, 0))}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
      <div className="text-muted-foreground mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
        <span>✓ 30 días gratis</span>
        <span>✓ Sin tarjeta</span>
        <span>✓ Cancelás cuando quieras</span>
      </div>
    </div>
  );
}

/* ───────────── Mobile sticky hero ───────────── */

export function SimuladorMobileHero({ result }: { result: SimplifiedSimulationResult }) {
  const d = deriveNumbers(result);

  return (
    <div className="bg-background/85 border-border supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30 -mx-4 border-b px-4 py-4 backdrop-blur-md md:hidden">
      <div className="flex items-center justify-between">
        <p className="text-primary inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase">
          <Sparkles className="h-3 w-3" />
          Recuperás
        </p>
        {d.roiMultiplier > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-3 w-3" />
            {d.roiMultiplier}×
          </span>
        )}
      </div>
      {d.hasGross ? (
        <>
          <p className="text-foreground mt-1 text-3xl leading-none font-bold tracking-tight tabular-nums">
            <AnimatedNumber value={d.grossAnnual} />
            <span className="text-muted-foreground ml-1 text-base font-normal">/año</span>
          </p>
          <p className="text-muted-foreground mt-1 text-xs tabular-nums">
            ≈ {formatMoney(d.grossMonthly)} por mes
          </p>
        </>
      ) : (
        <p className="text-muted-foreground mt-2 text-sm">
          Movés un slider para ver tu devolución.
        </p>
      )}
    </div>
  );
}

/* ───────────── Mobile sticky bottom CTA ───────────── */

export function SimuladorMobileCta({ result }: { result: SimplifiedSimulationResult }) {
  const d = deriveNumbers(result);

  if (!d.hasPositiveNet) return null;

  const ctaAmount = formatCompactM(d.netAnnual);

  return (
    <div className="bg-background/90 border-border supports-[backdrop-filter]:bg-background/75 sticky bottom-0 z-30 -mx-4 border-t px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur-md md:hidden">
      <Button asChild size="lg" className="h-12 w-full text-base">
        <Link href="/login">
          Recuperar {ctaAmount}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
      <p className="text-muted-foreground mt-2 text-center text-[11px]">
        30 días gratis · sin tarjeta
      </p>
    </div>
  );
}
