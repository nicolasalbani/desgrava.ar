"use client";

import { useState, useRef, useEffect, useCallback, Suspense, type ElementType } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Upload, PenLine, Download, UserRound } from "lucide-react";
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
import { ArcaImportButton } from "@/components/shared/arca-import-button";
import { useFiscalYear } from "@/contexts/fiscal-year";
import { useDomesticWorkerCount } from "@/contexts/domestic-worker-count";
import { cn } from "@/lib/utils";
import { useFiscalYearReadOnly } from "@/hooks/use-fiscal-year-read-only";
import { useArcaImportProgress } from "@/hooks/use-arca-import-progress";

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

function NoWorkersEmptyState() {
  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-2 flex flex-col items-center justify-center py-20 text-center duration-500"
      style={{ animationFillMode: "backwards" }}
    >
      <div className="bg-muted mb-4 flex h-12 w-12 items-center justify-center rounded-full">
        <UserRound className="text-muted-foreground/50 h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold">No tenés trabajadores registrados</h2>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">
        Para cargar recibos salariales, primero registrá al menos un trabajador a cargo en tu perfil
        impositivo.
      </p>
      <Button asChild variant="outline" className="mt-4">
        <Link href="/perfil">Ir a Perfil impositivo</Link>
      </Button>
    </div>
  );
}

function RecibosInner() {
  const { fiscalYear } = useFiscalYear();
  const readOnly = useFiscalYearReadOnly();
  const { hasWorkers, loading: workersLoading } = useDomesticWorkerCount();
  const { snapshot } = useArcaImportProgress();
  const searchParams = useSearchParams();
  const firstLoadDone = useRef(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  // Refresh the list when a PULL_DOMESTIC_RECEIPTS job transitions from
  // running to completed. The strip handles all other progress feedback.
  const wasReceiptsCompleted = useRef(false);
  useEffect(() => {
    const isCompleted = snapshot.completedTypes.includes("PULL_DOMESTIC_RECEIPTS");
    if (isCompleted && !wasReceiptsCompleted.current) {
      setRefreshKey((k) => k + 1);
    }
    wasReceiptsCompleted.current = isCompleted;
  }, [snapshot.completedTypes]);

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

  if (!workersLoading && !hasWorkers) {
    return <NoWorkersEmptyState />;
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
          <ArcaImportButton
            mode="toolbar"
            jobType="PULL_DOMESTIC_RECEIPTS"
            fiscalYear={fiscalYear}
            icon={Download}
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
