"use client";

import { useState, useRef, useCallback, useEffect, Suspense, type ElementType } from "react";
import { Download, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PresentacionesList } from "@/components/presentaciones/presentaciones-list";
import { ImportArcaPresentacionesDialog } from "@/components/presentaciones/import-arca-dialog";
import { SubmitPresentacionDialog } from "@/components/presentaciones/submit-presentacion-dialog";
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
  const firstLoadDone = useRef(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [activeImportJobId, setActiveImportJobId] = useState<string | null>(null);
  const resumeCheckedRef = useRef(false);

  // Check for an active PULL_PRESENTACIONES job on mount and auto-resume
  useEffect(() => {
    if (resumeCheckedRef.current) return;
    resumeCheckedRef.current = true;

    fetch("/api/automatizacion?activeJob=PULL_PRESENTACIONES")
      .then((r) => r.json())
      .then((data) => {
        if (data.job) {
          setActiveImportJobId(data.job.id);
          setImportOpen(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleInitialLoad = useCallback((_count: number) => {
    if (!firstLoadDone.current) {
      firstLoadDone.current = true;
    }
  }, []);

  function handleImportComplete() {
    setRefreshKey((k) => k + 1);
  }

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
          <ExpandingButton
            icon={Download}
            label="Importar desde ARCA"
            onClick={() => setImportOpen(true)}
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

      <ImportArcaPresentacionesDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImportComplete={handleImportComplete}
        activeJobId={activeImportJobId}
      />

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
