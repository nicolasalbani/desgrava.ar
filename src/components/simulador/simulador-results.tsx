"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
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
function AnimatedMoney({ value, prefix = "" }: { value: number; prefix?: string }) {
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

  return (
    <>
      {prefix}
      {formatMoney(displayed)}
    </>
  );
}

export function SimuladorResults({ result }: { result: SimplifiedSimulationResult }) {
  const ahorroMensual = parseFloat(result.ahorroMensualHasta);
  const ahorroAnual = parseFloat(result.ahorroAnualHasta);
  const netoMensual = parseFloat(result.ahorroNetoMensual);
  const netoAnual = parseFloat(result.ahorronetoAnual);
  const planCostoMensual = PERSONAL_PLAN_MONTHLY_COST;

  return (
    <div className="border-border rounded-xl border bg-green-50/50 p-5 dark:bg-green-950/20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: savings info */}
        <div className="flex items-center gap-3">
          <span className="text-3xl" role="img" aria-label="money">
            🤑
          </span>
          <div>
            <p className="text-2xl font-bold text-green-600 tabular-nums dark:text-green-400">
              <AnimatedMoney value={ahorroMensual} prefix="hasta " />
              <span className="text-muted-foreground ml-1 text-sm font-normal">/mes</span>
            </p>
            <p className="text-muted-foreground text-xs tabular-nums">
              <AnimatedMoney value={ahorroAnual} prefix="hasta " /> por año
              {netoAnual > 0 && (
                <>
                  {" · "}
                  neto{" "}
                  <span className="text-foreground font-medium">
                    <AnimatedMoney value={netoMensual} prefix="" />
                    /mes
                  </span>{" "}
                  despues del plan ({formatMoney(planCostoMensual)}/mes)
                </>
              )}
            </p>
          </div>
        </div>

        {/* Right: CTA */}
        {ahorroMensual > 0 && (
          <Button asChild size="lg" className="shrink-0">
            <Link href="/login">
              Empeza a desgravar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
