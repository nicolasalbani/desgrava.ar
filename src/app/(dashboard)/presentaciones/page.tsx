"use client";

import { useState, useRef, useCallback, useEffect, Suspense, type ElementType } from "react";
import { Download, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PresentacionesList } from "@/components/presentaciones/presentaciones-list";
import { SubmitPresentacionDialog } from "@/components/presentaciones/submit-presentacion-dialog";
import { ArcaImportButton } from "@/components/shared/arca-import-button";
import { useArcaImportProgress } from "@/hooks/use-arca-import-progress";
import { useFiscalYear } from "@/contexts/fiscal-year";
import { cn } from "@/lib/utils";
import { useFiscalYearReadOnly } from "@/hooks/use-fiscal-year-read-only";

function ExpandingButton({
  icon: Icon,
  label,
  onClick,
  variant = "outline",
  className,
  disabled,
}: {
  icon: ElementType<{ className?: string }>;
  label: string;
  onClick: () => void;
  variant?: "outline" | "default";
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      className={cn("group gap-0 overflow-hidden transition-all duration-300", className)}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-out group-hover:ml-2 group-hover:max-w-[200px] group-hover:opacity-100">
        {label}
      </span>
    </Button>
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
        <div className="flex items-center gap-2">
          <ArcaImportButton
            mode="toolbar"
            jobType="PULL_PRESENTACIONES"
            fiscalYear={fiscalYear}
            icon={Download}
            disabled={readOnly}
          />
          <ExpandingButton
            icon={Send}
            label="Crear nueva presentacion"
            onClick={() => setSubmitOpen(true)}
            disabled={readOnly}
            variant="default"
          />
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
