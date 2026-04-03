"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useFiscalYear } from "@/contexts/fiscal-year";
import { StepProgress } from "@/components/shared/step-progress";
import { JOB_TYPE_STEPS } from "@/lib/automation/job-steps";

type Status = "idle" | "running" | "completed" | "failed";

export function ImportArcaReceiptsDialog({
  open,
  onOpenChange,
  onImportComplete,
  activeJobId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImportComplete: () => void;
  activeJobId?: string | null;
}) {
  const { fiscalYear } = useFiscalYear();
  const year = fiscalYear ?? new Date().getFullYear();

  const [status, setStatus] = useState<Status>("idle");
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const skippedBoolRef = useRef(false);
  const [skipPrefLoaded, setSkipPrefLoaded] = useState(false);
  const skippedRef = useRef<string[]>([]);
  const autoStartedRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const connectedJobRef = useRef<string | null>(null);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  // Fetch skip preference on mount
  useEffect(() => {
    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((data) => {
        const arr: string[] = data.preference?.skippedArcaDialogs ?? [];
        skippedRef.current = arr;
        const isSkipped = arr.includes("import-recibos");
        skippedBoolRef.current = isSkipped;
        setSkipped(isSkipped);
        setSkipPrefLoaded(true);
      })
      .catch(() => setSkipPrefLoaded(true));
  }, []);

  // Reset when dialog opens (but not if we're reconnecting to an active job)
  useEffect(() => {
    if (open && status !== "running") {
      setStatus("idle");
      setCurrentStep(null);
      setErrorMessage(null);
      autoStartedRef.current = false;
    }
  }, [open, status]);

  const connectToSSE = useCallback(
    (jobId: string, existingStep?: string | null) => {
      // Don't reconnect to the same job
      if (connectedJobRef.current === jobId) return;

      eventSourceRef.current?.close();
      connectedJobRef.current = jobId;

      // Restore existing step from DB if reconnecting
      if (existingStep) {
        setCurrentStep(existingStep);
      }

      setStatus("running");

      const es = new EventSource(`/api/automatizacion/${jobId}/logs`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.step) {
            setCurrentStep(data.step);
          }
          if (data.done) {
            es.close();
            eventSourceRef.current = null;
            connectedJobRef.current = null;
            if (data.status === "COMPLETED") {
              setStatus("completed");
              toast.success("Recibos salariales importados desde ARCA");
              onImportComplete();
              // Auto-close dialog after a short delay so the user sees the success state
              setTimeout(() => onOpenChange(false), 1500);
            } else {
              // Fetch the job's errorMessage for the failed state
              fetch(`/api/automatizacion/${jobId}`)
                .then((r) => r.json())
                .then((d) => {
                  if (d.job?.errorMessage) {
                    setErrorMessage(d.job.errorMessage);
                  }
                })
                .catch(() => {});
              setStatus("failed");
              toast.error("Error al importar recibos salariales");
            }
          }
        } catch {
          // ignore
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        connectedJobRef.current = null;
        setStatus("failed");
        toast.error("Se perdio la conexion con el servidor");
      };
    },
    [onImportComplete],
  );

  // Reconnect to an active job when the dialog opens with an activeJobId
  useEffect(() => {
    if (open && activeJobId && status !== "running") {
      // Fetch existing job data before connecting to SSE
      fetch(`/api/automatizacion/${activeJobId}`)
        .then((r) => r.json())
        .then((data) => {
          const existingStep = data.job?.currentStep ?? null;
          connectToSSE(activeJobId, existingStep);
        })
        .catch(() => {
          connectToSSE(activeJobId);
        });
    }
  }, [open, activeJobId, status, connectToSSE]);

  async function saveSkipPreference(checked: boolean) {
    setSkipped(checked);
    const key = "import-recibos";
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

  const handleStart = useCallback(async () => {
    setStatus("running");
    setCurrentStep(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/automatizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType: "PULL_DOMESTIC_RECEIPTS",
          fiscalYear: year,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al iniciar importacion");
      }

      const { job } = await res.json();
      connectToSSE(job.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al importar");
      setStatus("failed");
    }
  }, [year, connectToSSE]);

  // Auto-start when skip preference is enabled (only on dialog open, not on checkbox change)
  useEffect(() => {
    if (
      open &&
      skipPrefLoaded &&
      skippedBoolRef.current &&
      status === "idle" &&
      !activeJobId &&
      !autoStartedRef.current
    ) {
      autoStartedRef.current = true;
      handleStart();
    }
  }, [open, skipPrefLoaded, status, activeJobId, handleStart]);

  // Poll job status as fallback for SSE step events
  useEffect(() => {
    if (status !== "running" || !connectedJobRef.current) return;
    const interval = setInterval(() => {
      const jobId = connectedJobRef.current;
      if (!jobId) return;
      fetch(`/api/automatizacion/${jobId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.job?.currentStep) {
            setCurrentStep(d.job.currentStep);
          }
          if (d.job?.status === "COMPLETED") {
            eventSourceRef.current?.close();
            eventSourceRef.current = null;
            connectedJobRef.current = null;
            setStatus("completed");
            onImportComplete();
          } else if (d.job?.status === "FAILED") {
            eventSourceRef.current?.close();
            eventSourceRef.current = null;
            connectedJobRef.current = null;
            if (d.job.errorMessage) setErrorMessage(d.job.errorMessage);
            setStatus("failed");
          }
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [status, onImportComplete]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar recibos salariales desde ARCA</DialogTitle>
          <DialogDescription>
            Se conectara a Personal de Casas Particulares y descargara los recibos de sueldo de
            todos los trabajadores.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {status === "idle" && (
            <div className="space-y-3">
              <div className="bg-muted/40 rounded-xl p-4 text-sm">
                <p className="text-foreground/80 mb-2 font-medium">Esto va a:</p>
                <ul className="text-muted-foreground space-y-1.5 text-xs">
                  <li>1. Iniciar sesión en ARCA con tus credenciales guardadas</li>
                  <li>2. Ir a &quot;Personal de Casas Particulares&quot;</li>
                  <li>3. Importar los datos de cada trabajador</li>
                  <li>4. Descargar los recibos de sueldo con archivos PDF</li>
                </ul>
                <p className="text-muted-foreground/70 mt-3 text-xs">
                  Los recibos que ya tengas cargados no se van a duplicar.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="skip-recibos"
                  checked={skipped}
                  onCheckedChange={(checked) => saveSkipPreference(checked === true)}
                />
                <label
                  htmlFor="skip-recibos"
                  className="text-muted-foreground cursor-pointer text-xs"
                >
                  No volver a mostrar este mensaje
                </label>
              </div>
              <Button onClick={handleStart} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Iniciar importacion
              </Button>
            </div>
          )}

          {status === "running" && (
            <div className="py-2">
              <StepProgress
                steps={JOB_TYPE_STEPS.PULL_DOMESTIC_RECEIPTS}
                currentStep={currentStep}
                status="RUNNING"
              />
            </div>
          )}

          {status === "completed" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <p className="text-sm font-medium">Importacion completada</p>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </div>
          )}

          {status === "failed" && (
            <div className="space-y-4 py-2">
              <StepProgress
                steps={JOB_TYPE_STEPS.PULL_DOMESTIC_RECEIPTS}
                currentStep={currentStep}
                status="FAILED"
                errorMessage={errorMessage}
              />
              <div className="flex justify-center gap-2 pt-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cerrar
                </Button>
                <Button onClick={handleStart}>Reintentar</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
