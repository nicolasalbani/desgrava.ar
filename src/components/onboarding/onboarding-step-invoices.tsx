"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download, CheckCircle2 } from "lucide-react";
import { StepProgress } from "@/components/shared/step-progress";
import { JOB_TYPE_STEPS } from "@/lib/automation/job-steps";
import { toast } from "sonner";

interface Props {
  onComplete: (hasDeducible: boolean) => void;
}

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  deducible: number;
}

export function OnboardingStepInvoices({ onComplete }: Props) {
  const [started, setStarted] = useState(false);
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
    setStarted(true);
    setJobStatus("RUNNING");
    setCurrentStep(null);
    try {
      const res = await fetch("/api/automatizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType: "PULL_COMPROBANTES",
          fiscalYear: new Date().getFullYear(),
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

  // Check deducible count after completion
  async function handleContinue() {
    const fiscalYear = new Date().getFullYear();
    try {
      const res = await fetch(
        `/api/facturas?fiscalYear=${fiscalYear}&pageSize=1&excludeNoDeducible=true&excludeSubmitted=true`,
      );
      const data = await res.json();
      onComplete((data.total ?? 0) > 0);
    } catch {
      // Fallback: use result if available
      onComplete((result?.deducible ?? 0) > 0);
    }
  }

  // Not started yet — show description + button
  if (!started) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-3 space-y-6 duration-500">
        <div className="text-center">
          <div className="bg-primary/10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
            <FileText className="text-primary h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold">Importar comprobantes de ARCA</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Vamos a descargar tus comprobantes de &quot;Mis Comprobantes&quot; en ARCA y clasificar
            automáticamente cuáles son deducibles.
          </p>
        </div>

        <div className="bg-muted/40 rounded-xl p-4 text-sm">
          <p className="text-foreground/80 mb-2 font-medium">Esto va a:</p>
          <ul className="text-muted-foreground space-y-1.5 text-xs">
            <li>1. Iniciar sesión en ARCA con tus credenciales</li>
            <li>2. Ir a &quot;Mis Comprobantes&quot; → Comprobantes recibidos</li>
            <li>3. Descargar y clasificar cada comprobante con IA</li>
          </ul>
        </div>

        <Button onClick={handleStart} className="w-full">
          <Download className="mr-2 h-4 w-4" />
          Importar desde ARCA
        </Button>
      </div>
    );
  }

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
      {jobStatus !== "COMPLETED" && (
        <div className="bg-muted/50 rounded-xl p-4">
          <StepProgress
            steps={JOB_TYPE_STEPS.PULL_COMPROBANTES}
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
          <Button onClick={handleContinue} className="w-full">
            Continuar
          </Button>
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
                setStarted(false);
                setJobStatus("PENDING");
                setCurrentStep(null);
                setResult(null);
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
