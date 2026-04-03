"use client";

import { useState, useRef, useEffect, useCallback, Suspense, type ElementType } from "react";
import { useSearchParams } from "next/navigation";
import { Upload, PenLine, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ReceiptUploader } from "@/components/recibos/receipt-uploader";
import { ReceiptForm } from "@/components/recibos/receipt-form";
import { ReceiptList } from "@/components/recibos/receipt-list";
import { ImportArcaReceiptsDialog } from "@/components/recibos/import-arca-dialog";
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
      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-out group-hover:ml-2 group-hover:max-w-[140px] group-hover:opacity-100">
        {label}
      </span>
    </Button>
  );
}

function RecibosInner() {
  const { fiscalYear } = useFiscalYear();
  const readOnly = useFiscalYearReadOnly();
  const searchParams = useSearchParams();
  const firstLoadDone = useRef(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [importArcaOpen, setImportArcaOpen] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Check for an active PULL_DOMESTIC_RECEIPTS job on mount and when fiscal year changes
  useEffect(() => {
    let cancelled = false;

    async function checkActiveJob() {
      try {
        const res = await fetch("/api/automatizacion");
        if (!res.ok) return;
        const { jobs } = await res.json();
        const active = jobs.find(
          (j: { jobType: string; fiscalYear?: number | null; status: string }) =>
            j.jobType === "PULL_DOMESTIC_RECEIPTS" &&
            j.fiscalYear === fiscalYear &&
            (j.status === "PENDING" || j.status === "RUNNING"),
        );
        if (active && !cancelled) {
          setActiveJobId(active.id);
          setImportArcaOpen(true);
        }
      } catch {
        // Best-effort
      }
    }

    checkActiveJob();
    return () => {
      cancelled = true;
    };
  }, [fiscalYear]);

  const handleInitialLoad = useCallback((_count: number) => {
    if (!firstLoadDone.current) {
      firstLoadDone.current = true;
    }
  }, []);

  function handleSaved() {
    setUploadOpen(false);
    setManualOpen(false);
    setRefreshKey((k) => k + 1);
  }

  function handleImportComplete() {
    setActiveJobId(null);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="space-y-6">
      <div
        className="animate-in fade-in slide-in-from-bottom-2 flex items-center justify-between duration-500"
        style={{ animationFillMode: "backwards" }}
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recibos salariales</h1>
          <p className="text-muted-foreground/70 mt-1 text-sm">
            Recibos de sueldo de personal de casas particulares
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExpandingButton
            icon={Download}
            label="Importar desde ARCA"
            onClick={() => setImportArcaOpen(true)}
            disabled={readOnly}
          />
          <ExpandingButton
            icon={PenLine}
            label="Carga manual"
            onClick={() => setManualOpen(true)}
            disabled={readOnly}
          />
          <ExpandingButton
            icon={Upload}
            label="Subir archivo"
            onClick={() => setUploadOpen(true)}
            disabled={readOnly}
            variant="default"
          />
        </div>
      </div>

      <div
        className="animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
      >
        <ReceiptList
          key={refreshKey}
          onInitialLoad={handleInitialLoad}
          attentionFilter={searchParams.get("filter") === "attention"}
          readOnly={readOnly}
        />
      </div>

      <ImportArcaReceiptsDialog
        open={importArcaOpen}
        onOpenChange={setImportArcaOpen}
        onImportComplete={handleImportComplete}
        activeJobId={activeJobId}
      />

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-h-[90vh] [grid-template-rows:auto_1fr] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Subir recibo salarial</DialogTitle>
            <DialogDescription>
              Subi un archivo PDF, JPG o PNG y extraeremos los datos automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto">
            <ReceiptUploader onSaved={handleSaved} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual entry dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-h-[90vh] [grid-template-rows:auto_1fr] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Carga manual</DialogTitle>
            <DialogDescription>
              Ingresa los datos del recibo salarial manualmente.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto">
            <ReceiptForm onSaved={handleSaved} onCancel={() => setManualOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RecibosPage() {
  return (
    <Suspense>
      <RecibosInner />
    </Suspense>
  );
}
