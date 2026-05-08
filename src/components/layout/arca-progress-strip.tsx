"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronUp, ChevronDown, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useArcaImportProgress } from "@/hooks/use-arca-import-progress";
import { TRACKED_JOB_TYPES, getJobTypeLabel } from "@/lib/onboarding/progress-stages";

const HIDE_AFTER_DONE_MS = 8000;

const TRACKED_SET = new Set<string>(TRACKED_JOB_TYPES);

export function ArcaProgressStrip() {
  const { snapshot, summary, queueState } = useArcaImportProgress();
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(true);
  // Tracks whether this strip instance has ever observed a running job. We
  // only show the green "completa" state if a run-to-done transition happened
  // during this mount — otherwise every page refresh would resurface the
  // success banner from imports that finished long ago.
  const observedRunningRef = useRef(false);

  // The strip switches into a non-import "indeterminate" mode when the only
  // active automation is something we don't have time-weighted progress for
  // (SUBMIT_*, PUSH_*, VALIDATE_CREDENTIALS). Tracked imports keep their
  // existing behavior unchanged.
  const nonImportActive =
    queueState.hasAnyActive &&
    snapshot.trackedCount === 0 &&
    (queueState.runningJobType === null || !TRACKED_SET.has(queueState.runningJobType));

  useEffect(() => {
    if (snapshot.trackedCount === 0 && !nonImportActive) {
      setHidden(true);
      observedRunningRef.current = false;
      return;
    }
    if (snapshot.hasRunning || nonImportActive) {
      observedRunningRef.current = true;
      setHidden(false);
      return;
    }
    if (snapshot.hasFailed) {
      // Failures are actionable — surface them on every visit.
      setHidden(false);
      return;
    }
    if (snapshot.allDone) {
      if (observedRunningRef.current) {
        setHidden(false);
        const t = setTimeout(() => setHidden(true), HIDE_AFTER_DONE_MS);
        return () => clearTimeout(t);
      }
      // Pre-existing completed jobs — stay hidden.
      setHidden(true);
    }
  }, [
    snapshot.trackedCount,
    snapshot.hasRunning,
    snapshot.hasFailed,
    snapshot.allDone,
    nonImportActive,
  ]);

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

  // Resolve the active label for non-import mode (or worker-saturation case).
  const nonImportLabel =
    queueState.runningJobType !== null
      ? getJobTypeLabel(queueState.runningJobType)
      : "Esperando que se libere un recurso para tomar la tarea…";

  // When a non-tracked job is running and we have time-weighted percent
  // (because its type has JOB_STEP_DURATIONS data), the strip shows real
  // progress instead of indeterminate animation. Falls back to indeterminate
  // for unknown types and for the worker-saturation case (no running job).
  const nonImportPercent = nonImportActive ? queueState.runningJobPercent : null;
  const nonImportDeterminate = nonImportActive && nonImportPercent !== null;

  // Collapsed pill (only when running, not done)
  if (collapsed && !snapshot.allDone) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label={
          nonImportActive
            ? `Expandir progreso: ${nonImportLabel}`
            : `Expandir progreso: ${snapshot.stageLabel}`
        }
        className="bg-card border-border fixed right-4 bottom-20 z-40 flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-full border px-3 py-2 shadow-lg sm:bottom-4"
      >
        <Loader2 className="text-primary h-4 w-4 animate-spin" />
        {nonImportActive ? (
          nonImportDeterminate ? (
            <span className="text-foreground text-xs font-medium tabular-nums">
              {nonImportPercent}%
            </span>
          ) : (
            <span className="text-foreground text-xs font-medium">En curso</span>
          )
        ) : (
          <span className="text-foreground text-xs font-medium tabular-nums">
            {snapshot.percent}%
          </span>
        )}
      </button>
    );
  }

  if (collapsed && snapshot.allDone) return null;

  const isDone = snapshot.allDone && !nonImportActive;
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

  // Primary line label: tracked imports use the stage label; non-import mode
  // uses the per-job-type label (or worker-saturation copy).
  const primaryLabel = isDone
    ? "Importación desde ARCA completa"
    : nonImportActive
      ? nonImportLabel
      : snapshot.stageLabel;

  // Secondary line copy. The strip stays focused on the currently running
  // task: its label + percent (or background-processing message in non-import
  // mode). Queued tasks wait silently in the background — surfaced via the
  // per-row "Esperando…" badge and the inline banner on list pages, never on
  // the strip itself.
  const secondaryLine = isDone
    ? (summaryText ?? "Tus datos de ARCA están al día.")
    : nonImportActive
      ? nonImportDeterminate
        ? `Procesando en segundo plano… ${nonImportPercent}%`
        : "Procesando en segundo plano…"
      : `Trayendo tus datos en segundo plano… ${snapshot.percent}%`;

  const ariaLabel = isDone
    ? "Importación de ARCA completa"
    : nonImportActive
      ? nonImportDeterminate
        ? `Automatización en curso: ${nonImportLabel}, ${nonImportPercent}%`
        : `Automatización en curso: ${nonImportLabel}`
      : `Importación de ARCA: ${snapshot.stageLabel}, ${snapshot.percent}%`;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className={cn(
        "relative border-b transition-colors",
        isDone
          ? "border-emerald-500/20 bg-emerald-500/[0.07] dark:bg-emerald-500/10"
          : "border-primary/15 bg-primary/[0.04] dark:bg-primary/10",
      )}
    >
      {/* Thin progress bar at the very top edge. In non-import mode the bar
          shows real percent when the running job has duration data, otherwise
          slides indeterminately as a fallback. */}
      <div className="bg-border/40 absolute inset-x-0 top-0 h-0.5 overflow-hidden">
        {nonImportActive && !nonImportDeterminate ? (
          <div className="bar-indeterminate bg-primary h-full" aria-hidden="true" />
        ) : (
          <div
            className={cn(
              "h-full transition-all duration-700 ease-out",
              isDone ? "bg-emerald-500" : "bg-primary",
            )}
            style={{
              width: `${nonImportDeterminate ? nonImportPercent : snapshot.percent}%`,
            }}
          />
        )}
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
            {primaryLabel}
          </p>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">{secondaryLine}</p>
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
