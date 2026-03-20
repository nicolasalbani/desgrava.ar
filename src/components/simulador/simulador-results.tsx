"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { SimplifiedSimulationResult } from "@/lib/simulador/calculator";
import { PERSONAL_PLAN_MONTHLY_COST } from "@/lib/simulador/calculator";

function formatMoney(value: number): string {
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// Animated number that counts up/down over ~400ms
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

function AnimatedRatio({ value }: { value: number }) {
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

  return <>${displayed}</>;
}

export function SimuladorResults({ result }: { result: SimplifiedSimulationResult }) {
  const ahorroMensual = parseFloat(result.ahorroMensualHasta);
  const netoMensual = parseFloat(result.ahorroNetoMensual);
  const netoAnual = parseFloat(result.ahorronetoAnual);
  const planCostoMensual = PERSONAL_PLAN_MONTHLY_COST;
  const roiMultiplier = planCostoMensual > 0 ? Math.floor(ahorroMensual / planCostoMensual) : 0;
  const hasPositiveNet = netoMensual > 0;

  // Edge case: no savings or net is zero/negative
  if (!hasPositiveNet) {
    return (
      <div className="border-border bg-muted/50 rounded-xl border p-5">
        <p className="text-muted-foreground text-center text-sm">
          {ahorroMensual > 0
            ? `Tus deducciones aun no cubren el costo del plan. Agrega mas gastos para ver tu ahorro.`
            : `Agrega gastos deducibles para ver cuanto podes ahorrar.`}
        </p>
      </div>
    );
  }

  return (
    <div className="border-border rounded-xl border bg-green-50/50 p-5 dark:bg-green-950/20">
      <div className="flex flex-col gap-5">
        {/* 1st: Before/after comparison */}
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
          {/* "Sin" card: muted, de-emphasized */}
          <div className="border-border bg-muted/50 flex-1 rounded-lg border p-3 text-center">
            <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
              Sin desgrava.ar
            </p>
            <p className="text-muted-foreground/60 mt-1 text-base tabular-nums">$0 recuperados</p>
          </div>
          <div className="hidden items-center sm:flex">
            <ArrowRight className="text-muted-foreground h-5 w-5" />
          </div>
          {/* "Con" card: prominent, green */}
          <div className="flex-1 rounded-lg border-2 border-green-300 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-950/40">
            <p className="text-[10px] font-medium tracking-wider text-green-700 uppercase dark:text-green-400">
              Con desgrava.ar
            </p>
            <p className="mt-1 text-xl font-bold text-green-600 tabular-nums dark:text-green-400">
              +<AnimatedNumber value={netoMensual} />
              <span className="text-sm font-normal">/mes</span>
            </p>
            <p className="mt-1.5 text-xs font-medium text-green-600/80 tabular-nums dark:text-green-400/70">
              <AnimatedNumber value={netoAnual} />
              /año
            </p>
          </div>
        </div>

        {/* 2nd: ROI + CTA side by side */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 shrink-0 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-lg font-bold tracking-tight text-green-700 dark:text-green-300">
                Por cada $1 que invertis, recuperas{" "}
                <span className="text-2xl text-green-600 dark:text-green-400">
                  <AnimatedRatio value={roiMultiplier} />
                </span>
              </p>
              <p className="text-muted-foreground text-sm tabular-nums">
                Plan Personal: {formatMoney(planCostoMensual)}/mes
              </p>
            </div>
          </div>
          <Button asChild size="lg" className="shrink-0">
            <Link href="/login">
              Quiero ahorrar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
