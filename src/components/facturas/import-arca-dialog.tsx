"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Download } from "lucide-react";
import { toast } from "sonner";
import { useFiscalYear } from "@/contexts/fiscal-year";
import { StepProgress } from "@/components/shared/step-progress";
import { JOB_TYPE_STEPS } from "@/lib/automation/job-steps";

type ImportState = "idle" | "running" | "completed" | "failed";

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: number;
  deducible?: number;
  nonDeducible?: number;
}

export function ImportArcaDialog({
  open,
  onOpenChange,
  onImportComplete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImportComplete?: () => void;
}) {
  const { fiscalYear } = useFiscalYear();
  const [state, setState] = useState<ImportState>("idle");
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const skippedBoolRef = useRef(false);
  const [skipPrefLoaded, setSkipPrefLoaded] = useState(false);
  const skippedRef = useRef<string[]>([]);
  const autoStartedRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Poll job status as fallback for SSE step events
  useEffect(() => {
    if (state !== "running" || !jobId) return;
    const interval = setInterval(() => {
      fetch(`/api/automatizacion/${jobId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.job?.currentStep) {
            setCurrentStep(d.job.currentStep);
          }
          if (d.job?.status === "COMPLETED") {
            cleanup();
            setState("completed");
            if (d.job.resultData) setResult(d.job.resultData as ImportResult);
            onImportComplete?.();
          } else if (d.job?.status === "FAILED") {
            cleanup();
            if (d.job.errorMessage) setErrorMessage(d.job.errorMessage);
            setState("failed");
          }
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [state, jobId, cleanup, onImportComplete]);

  // Fetch skip preference on mount
  useEffect(() => {
    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((data) => {
        const arr: string[] = data.preference?.skippedArcaDialogs ?? [];
        skippedRef.current = arr;
        const isSkipped = arr.includes("import-facturas");
        skippedBoolRef.current = isSkipped;
        setSkipped(isSkipped);
        setSkipPrefLoaded(true);
      })
      .catch(() => setSkipPrefLoaded(true));
  }, []);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setState("idle");
      setCurrentStep(null);
      setErrorMessage(null);
      setResult(null);
      setJobId(null);
      autoStartedRef.current = false;
    } else {
      cleanup();
    }
  }, [open, cleanup]);

  const startImport = useCallback(async () => {
    if (!fiscalYear) {
      toast.error("Selecciona un año fiscal primero");
      return;
    }

    setState("running");
    setCurrentStep(null);
    setErrorMessage(null);
    setResult(null);

    try {
      const res = await fetch("/api/automatizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType: "PULL_COMPROBANTES", fiscalYear }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const errorMsg = data?.error ?? "Error al iniciar la importación";
        toast.error(errorMsg);
        setState("failed");
        return;
      }

      const data = await res.json();
      const newJobId = data.job.id;
      setJobId(newJobId);

      // Start SSE connection
      const es = new EventSource(`/api/automatizacion/${newJobId}/logs`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.step) {
            setCurrentStep(payload.step);
          }

          if (payload.done) {
            es.close();
            eventSourceRef.current = null;

            if (payload.status === "COMPLETED") {
              setState("completed");
              // Fetch final result from job
              fetch(`/api/automatizacion/${newJobId}`)
                .then((r) => r.json())
                .then((d) => {
                  if (d.job?.resultData) {
                    setResult(d.job.resultData as ImportResult);
                  }
                  if (d.job?.errorMessage) {
                    setErrorMessage(d.job.errorMessage);
                  }
                })
                .catch(() => {});
              onImportComplete?.();
            } else {
              // Fetch error message for failed state
              fetch(`/api/automatizacion/${newJobId}`)
                .then((r) => r.json())
                .then((d) => {
                  if (d.job?.errorMessage) {
                    setErrorMessage(d.job.errorMessage);
                  }
                })
                .catch(() => {});
              setState("failed");
            }
          }
        } catch {
          // Ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        // Don't set failed — the job might still be running server-side
      };
    } catch {
      toast.error("Error de conexión al iniciar la importación");
      setState("failed");
    }
  }, [fiscalYear, onImportComplete]);

  // Auto-start when skip preference is enabled (only on dialog open, not on checkbox change)
  useEffect(() => {
    if (
      open &&
      skipPrefLoaded &&
      skippedBoolRef.current &&
      state === "idle" &&
      !autoStartedRef.current
    ) {
      autoStartedRef.current = true;
      startImport();
    }
  }, [open, skipPrefLoaded, state, startImport]);

  async function saveSkipPreference(checked: boolean) {
    setSkipped(checked);
    const key = "import-facturas";
    const updated = checked
      ? [...skippedRef.current.filter((k) => k !== key), key]
      : skippedRef.current.filter((k) => k !== key);
    skippedRef.current = updated;
    try {
      await fetch("/api/configuracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skippedArcaDialogs: updated }),
      });
    } catch {
      // Silently fail — preference is non-critical
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar desde ARCA</DialogTitle>
          <DialogDescription>
            Importa automáticamente tus comprobantes recibidos desde el servicio &quot;Mis
            Comprobantes&quot; de ARCA para el año fiscal {fiscalYear ?? "seleccionado"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {state === "idle" && (
            <div className="space-y-3">
              <div className="bg-muted/40 rounded-xl p-4 text-sm">
                <p className="text-foreground/80 mb-2 font-medium">Esto va a:</p>
                <ul className="text-muted-foreground space-y-1.5 text-xs">
                  <li>1. Iniciar sesión en ARCA con tus credenciales guardadas</li>
                  <li>2. Ir a &quot;Mis Comprobantes&quot; → Comprobantes Recibidos</li>
                  <li>3. Buscar todos los comprobantes del año {fiscalYear}</li>
                  <li>4. Exportar como CSV e importar cada comprobante</li>
                  <li>5. Clasificar automáticamente la categoría de deducción con IA</li>
                </ul>
                <p className="text-muted-foreground/70 mt-3 text-xs">
                  Los comprobantes que ya tengas cargados no se van a duplicar.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="skip-facturas"
                  checked={skipped}
                  onCheckedChange={(checked) => saveSkipPreference(checked === true)}
                />
                <label
                  htmlFor="skip-facturas"
                  className="text-muted-foreground cursor-pointer text-xs"
                >
                  No volver a mostrar este mensaje
                </label>
              </div>
              <Button onClick={startImport} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Iniciar importación
              </Button>
            </div>
          )}

          {state === "running" && (
            <StepProgress
              steps={JOB_TYPE_STEPS.PULL_COMPROBANTES}
              currentStep={currentStep}
              status="RUNNING"
            />
          )}

          {state === "completed" && (
            <CompletedView result={result} onClose={() => onOpenChange(false)} />
          )}

          {state === "failed" && (
            <div className="space-y-4">
              <StepProgress
                steps={JOB_TYPE_STEPS.PULL_COMPROBANTES}
                currentStep={currentStep}
                status="FAILED"
                errorMessage={errorMessage}
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                  Cerrar
                </Button>
                <Button onClick={startImport} className="flex-1">
                  Reintentar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompletedView({ result, onClose }: { result: ImportResult | null; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        <span className="text-sm font-medium">Importación completada</span>
      </div>
      {result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-semibold tabular-nums">{result.total}</p>
              <p className="text-muted-foreground text-xs">Encontrados</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
                {result.imported}
              </p>
              <p className="text-muted-foreground text-xs">Importados</p>
            </div>
            {result.deducible != null && (
              <div>
                <p className="text-2xl font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
                  {result.deducible}
                </p>
                <p className="text-muted-foreground text-xs">Deducibles</p>
              </div>
            )}
            {result.nonDeducible != null && (
              <div>
                <p className="text-foreground/50 text-2xl font-semibold tabular-nums">
                  {result.nonDeducible}
                </p>
                <p className="text-muted-foreground text-xs">No deducibles</p>
              </div>
            )}
            <div>
              <p className="text-foreground/50 text-2xl font-semibold tabular-nums">
                {result.skipped}
              </p>
              <p className="text-muted-foreground text-xs">Duplicados</p>
            </div>
            <div>
              <p
                className={`text-2xl font-semibold tabular-nums ${result.errors > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground/50"}`}
              >
                {result.errors}
              </p>
              <p className="text-muted-foreground text-xs">Errores</p>
            </div>
          </div>
        </div>
      )}
      <Button variant="outline" onClick={onClose} className="w-full">
        Cerrar
      </Button>
    </div>
  );
}
