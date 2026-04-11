"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle2 } from "lucide-react";
import { StepProgress } from "@/components/shared/step-progress";
import type { StepDefinition } from "@/lib/automation/job-steps";
import { toast } from "sonner";

const ONBOARDING_PULL_STEPS: StepDefinition[] = [
  { key: "navigate_comprobantes", label: "Buscando comprobantes deducibles" },
  { key: "download", label: "Extrayendo comprobantes deducibles" },
  { key: "classify", label: "Clasificando proveedores" },
];

interface Props {
  activeJobId?: string | null;
  onComplete: (hasDeducible: boolean) => void;
}

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  deducible: number;
}

export function OnboardingStepInvoices({ activeJobId, onComplete }: Props) {
  const startedRef = useRef(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>("PENDING");
  const [result, setResult] = useState<ImportResult | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connectToSSE = useCallback((jobId: string) => {
    eventSourceRef.current?.close();
    const es = new EventSource(`/api/automatizacion/${jobId}/logs`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.step) setCurrentStep(data.step);
        if (data.done) {
          es.close();
          eventSourceRef.current = null;
          setJobStatus(data.status === "COMPLETED" ? "COMPLETED" : "FAILED");
          if (data.result) {
            setResult(data.result);
          }
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setJobStatus("FAILED");
    };
  }, []);

  async function handleStart() {
    setJobStatus("RUNNING");
    setCurrentStep(null);
    try {
      const res = await fetch("/api/automatizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType: "PULL_COMPROBANTES",
          fiscalYear: new Date().getFullYear(),
          skipSiradigExtraction: true,
        }),
      });
      if (!res.ok) throw new Error();
      const { job } = await res.json();
      connectToSSE(job.id);
    } catch {
      toast.error("Error al iniciar importación");
      setJobStatus("FAILED");
    }
  }

  // Check deducible count after completion — include already-submitted invoices
  // so step 4 is never skipped (the user must experience the full onboarding).
  // Default to true on any error so step 4 is always shown.
  async function handleContinue() {
    const fiscalYear = new Date().getFullYear();
    try {
      const res = await fetch(
        `/api/facturas?fiscalYear=${fiscalYear}&pageSize=1&excludeNoDeducible=true`,
      );
      if (!res.ok) {
        onComplete(true);
        return;
      }
      const data = await res.json();
      onComplete((data.pagination?.totalCount ?? 0) > 0);
    } catch {
      // On network error, always show step 4 — skipping is worse
      onComplete(true);
    }
  }

  // Resume an active job or auto-start a new one
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (activeJobId) {
      // Resume: check if already completed, otherwise connect to SSE
      fetch(`/api/automatizacion/${activeJobId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.job?.status === "COMPLETED") {
            setJobStatus("COMPLETED");
            if (data.job.result) setResult(data.job.result);
          } else if (data.job?.status === "FAILED") {
            setJobStatus("FAILED");
          } else {
            setJobStatus("RUNNING");
            if (data.job?.currentStep) setCurrentStep(data.job.currentStep);
            connectToSSE(activeJobId);
          }
        })
        .catch(() => {
          setJobStatus("RUNNING");
          connectToSSE(activeJobId);
        });
    } else {
      handleStart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-advance when import completes
  useEffect(() => {
    if (jobStatus === "COMPLETED") {
      // Brief delay so user sees the success state
      const timer = setTimeout(() => handleContinue(), 1500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobStatus]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  return (
    <div className="animate-in fade-in space-y-6 duration-500">
      <div className="text-center">
        <div className="bg-primary/10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
          <FileText className="text-primary h-7 w-7" />
        </div>
        <h2 className="text-xl font-semibold">
          {jobStatus === "COMPLETED" ? "Comprobantes importados" : "Importando comprobantes"}
        </h2>
      </div>

      {/* Progress */}
      {jobStatus !== "COMPLETED" && jobStatus !== "FAILED" && (
        <div className="bg-muted/50 rounded-xl p-4">
          <StepProgress
            steps={ONBOARDING_PULL_STEPS}
            currentStep={currentStep}
            status={jobStatus}
          />
        </div>
      )}

      {/* Success */}
      {jobStatus === "COMPLETED" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                Importación completa
              </span>
            </div>
            {result && (
              <div className="text-muted-foreground space-y-1 text-xs">
                <p>{result.total} comprobantes encontrados</p>
                <p>{result.imported} importados</p>
                {result.skipped > 0 && <p>{result.skipped} ya existían</p>}
                {result.deducible > 0 && (
                  <p className="text-foreground font-medium">{result.deducible} deducibles</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Failed */}
      {jobStatus === "FAILED" && (
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground text-sm">Hubo un error al importar comprobantes.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                startedRef.current = false;
                setJobStatus("PENDING");
                setCurrentStep(null);
                setResult(null);
                handleStart();
              }}
            >
              Reintentar
            </Button>
            <Button className="flex-1" onClick={() => onComplete(false)}>
              Continuar al panel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
