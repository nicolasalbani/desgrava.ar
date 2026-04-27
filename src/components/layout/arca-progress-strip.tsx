"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronUp, ChevronDown, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useArcaImportProgress } from "@/hooks/use-arca-import-progress";

const HIDE_AFTER_DONE_MS = 8000;

export function ArcaProgressStrip() {
  const { snapshot, summary } = useArcaImportProgress();
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(true);

  // Reveal whenever any tracked job exists. Auto-hide a few seconds after `done`.
  useEffect(() => {
    if (snapshot.trackedCount === 0) {
      setHidden(true);
      return;
    }
    setHidden(false);
    if (snapshot.allDone) {
      const t = setTimeout(() => setHidden(true), HIDE_AFTER_DONE_MS);
      return () => clearTimeout(t);
    }
  }, [snapshot.trackedCount, snapshot.allDone]);

  if (hidden) return null;

  // Failed state — amber banner
  if (snapshot.hasFailed) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Error en importación de ARCA"
        className="border-b border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-medium">Hubo un problema con la importación</p>
            <p className="text-xs opacity-80">
              Uno de los pasos falló. Revisá los detalles para reintentarlo.
            </p>
          </div>
          <Link href="/automatizacion" className="text-xs font-medium underline underline-offset-2">
            Ver detalles
          </Link>
        </div>
      </div>
    );
  }

  // Collapsed pill (only when running, not done)
  if (collapsed && !snapshot.allDone) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label={`Expandir progreso: ${snapshot.stageLabel}`}
        className="bg-card border-border fixed right-4 bottom-20 z-40 flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-full border px-3 py-2 shadow-lg sm:bottom-4"
      >
        <Loader2 className="text-primary h-4 w-4 animate-spin" />
        <span className="text-foreground text-xs font-medium tabular-nums">
          {snapshot.percent}%
        </span>
      </button>
    );
  }

  if (collapsed && snapshot.allDone) return null;

  const isDone = snapshot.allDone;
  const summaryParts: string[] = [];
  if (summary.invoices > 0) {
    summaryParts.push(
      `${summary.invoices} ${summary.invoices === 1 ? "comprobante" : "comprobantes"}`,
    );
  }
  if (summary.receipts > 0) {
    summaryParts.push(`${summary.receipts} ${summary.receipts === 1 ? "recibo" : "recibos"}`);
  }
  if (summary.presentaciones > 0) {
    summaryParts.push(
      `${summary.presentaciones} ${summary.presentaciones === 1 ? "presentación" : "presentaciones"}`,
    );
  }
  const summaryText = summaryParts.length > 0 ? `Trajimos ${summaryParts.join(", ")}.` : null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={
        isDone
          ? "Importación de ARCA completa"
          : `Importación de ARCA: ${snapshot.stageLabel}, ${snapshot.percent}%`
      }
      className={cn(
        "relative border-b transition-colors",
        isDone
          ? "border-emerald-500/20 bg-emerald-500/[0.07] dark:bg-emerald-500/10"
          : "border-primary/15 bg-primary/[0.04] dark:bg-primary/10",
      )}
    >
      {/* Thin progress bar at the very top edge */}
      <div className="bg-border/40 absolute inset-x-0 top-0 h-0.5 overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-700 ease-out",
            isDone ? "bg-emerald-500" : "bg-primary",
          )}
          style={{ width: `${snapshot.percent}%` }}
        />
      </div>

      <div className="flex items-start gap-3 px-4 py-3 sm:items-center sm:py-3">
        {isDone ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 sm:mt-0 dark:text-emerald-400" />
        ) : (
          <Loader2 className="text-primary mt-0.5 h-5 w-5 shrink-0 animate-spin sm:mt-0" />
        )}

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-medium",
              isDone ? "text-emerald-700 dark:text-emerald-400" : "text-foreground",
            )}
          >
            {isDone ? "Importación desde ARCA completa" : snapshot.stageLabel}
          </p>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {isDone
              ? (summaryText ?? "Tus datos de ARCA están al día.")
              : `Trayendo tus datos en segundo plano… ${snapshot.percent}%`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label={isDone ? "Cerrar" : "Minimizar progreso"}
          className="text-muted-foreground hover:text-foreground -mr-1 flex h-8 min-h-[36px] w-8 min-w-[36px] items-center justify-center rounded-md"
        >
          {isDone ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
