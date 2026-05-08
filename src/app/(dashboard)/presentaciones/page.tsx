"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { Download, Send, Loader2 } from "lucide-react";
import { PresentacionesList } from "@/components/presentaciones/presentaciones-list";
import { SubmitPresentacionDialog } from "@/components/presentaciones/submit-presentacion-dialog";
import { ArcaImportButton } from "@/components/shared/arca-import-button";
import { CreatePresentacionSpotlight } from "@/components/presentaciones/create-presentacion-spotlight";
import { useArcaImportProgress } from "@/hooks/use-arca-import-progress";
import { useFiscalYear } from "@/contexts/fiscal-year";
import { cn } from "@/lib/utils";
import { useFiscalYearReadOnly } from "@/hooks/use-fiscal-year-read-only";

/**
 * "Crear nueva presentacion" toolbar button. Mirrors `<ArcaImportButton>`'s
 * toolbar shape (icon-at-rest, expands on hover, progress fill while active)
 * but reads the SUBMIT_PRESENTACION job state from `queueState` rather than
 * `snapshot` — SUBMIT_PRESENTACION isn't a tracked import type, so its
 * progress lives in queueState only.
 */
function SubmitPresentacionButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  const { queueState } = useArcaImportProgress();
  const isRunning = queueState.runningJobType === "SUBMIT_PRESENTACION";
  const isWaiting = queueState.queuedJobTypes.includes("SUBMIT_PRESENTACION");
  const isActive = isRunning || isWaiting;
  const percent = isRunning ? (queueState.runningJobPercent ?? 0) : 0;
  // Match ArcaImportButton's behavior: render the fill bar from 0% on the
  // first frame the job is running, so the visual transition is immediate
  // (the bar grows from 0 → percent over the next few ticks).
  const showFill = isRunning;
  const activeLabel = isWaiting ? "Esperando…" : "Procesando…";
  const idleLabel = "Crear nueva presentacion";

  const isDisabled = disabled || isActive;
  const ariaLabel = isRunning
    ? `${idleLabel} en progreso, ${percent}%`
    : isWaiting
      ? `${idleLabel}, esperando que termine la tarea actual`
      : idleLabel;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-label={ariaLabel}
      className={cn(
        "group bg-primary text-primary-foreground hover:bg-primary/90 relative inline-flex h-9 items-center overflow-hidden rounded-md px-3 text-sm font-medium transition-colors",
        isDisabled && "cursor-not-allowed opacity-70",
        isActive && "ring-primary/20 ring-2 ring-offset-0",
      )}
    >
      {showFill && (
        <span
          className="bg-foreground/15 absolute inset-y-0 left-0 transition-all duration-700 ease-out"
          style={{ width: `${percent}%` }}
          aria-hidden="true"
        />
      )}
      <span className="relative flex items-center">
        {isActive ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <Send className="h-4 w-4 shrink-0" />
        )}
        <span
          className={cn(
            "max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-out",
            isActive
              ? "ml-2 max-w-[240px] opacity-100"
              : "group-hover:ml-2 group-hover:max-w-[240px] group-hover:opacity-100",
          )}
        >
          {isActive ? activeLabel : idleLabel}
        </span>
      </span>
    </button>
  );
}

function PresentacionesInner() {
  const readOnly = useFiscalYearReadOnly();
  const { fiscalYear } = useFiscalYear();
  const { snapshot } = useArcaImportProgress();
  const firstLoadDone = useRef(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [submitOpen, setSubmitOpen] = useState(false);

  // Refresh the list when a PULL_PRESENTACIONES job transitions to completed.
  // The strip handles all other progress feedback.
  const wasPresentacionesCompleted = useRef(false);
  useEffect(() => {
    const isCompleted = snapshot.completedTypes.includes("PULL_PRESENTACIONES");
    if (isCompleted && !wasPresentacionesCompleted.current) {
      setRefreshKey((k) => k + 1);
    }
    wasPresentacionesCompleted.current = isCompleted;
  }, [snapshot.completedTypes]);

  const handleInitialLoad = useCallback((_count: number) => {
    if (!firstLoadDone.current) {
      firstLoadDone.current = true;
    }
  }, []);

  function handleSubmitComplete() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="space-y-6">
      <div
        className="animate-in fade-in slide-in-from-bottom-2 flex items-center justify-between duration-500"
        style={{ animationFillMode: "backwards" }}
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Presentaciones</h1>
          <p className="text-muted-foreground/70 mt-1 text-sm">
            Formularios F.572 Web enviados al empleador via SiRADIG
          </p>
        </div>
        <div data-tour="presentaciones-actions" className="flex items-center gap-2">
          <ArcaImportButton
            mode="toolbar"
            jobType="PULL_PRESENTACIONES"
            fiscalYear={fiscalYear}
            icon={Download}
            disabled={readOnly}
          />
          <SubmitPresentacionButton onClick={() => setSubmitOpen(true)} disabled={readOnly} />
        </div>
      </div>

      <div
        className="animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
      >
        <PresentacionesList key={refreshKey} onInitialLoad={handleInitialLoad} />
      </div>

      <SubmitPresentacionDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        onSubmitComplete={handleSubmitComplete}
      />

      <CreatePresentacionSpotlight />
    </div>
  );
}

export default function PresentacionesPage() {
  return (
    <Suspense>
      <PresentacionesInner />
    </Suspense>
  );
}
