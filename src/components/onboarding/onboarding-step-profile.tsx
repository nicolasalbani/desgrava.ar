"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { User, ExternalLink, RefreshCw, SkipForward, CheckCircle2 } from "lucide-react";
import { StepProgress } from "@/components/shared/step-progress";
import type { StepDefinition } from "@/lib/automation/job-steps";
import { toast } from "sonner";

const ONBOARDING_PROFILE_STEPS: StepDefinition[] = [
  { key: "login", label: "Iniciando sesión en ARCA" },
  { key: "siradig", label: "Abriendo SiRADIG" },
  { key: "datos_personales", label: "Extrayendo datos personales" },
  { key: "empleadores", label: "Extrayendo empleadores" },
  { key: "cargas_familia", label: "Extrayendo cargas de familia" },
  { key: "casas_particulares", label: "Extrayendo trabajadores domésticos" },
];

interface Props {
  pullProfileJobId: string | null;
  onComplete: () => void;
}

interface ProfileSummary {
  employers: number;
  familyDependents: number;
  domesticWorkers: number;
  hasPersonalData: boolean;
}

export function OnboardingStepProfile({ pullProfileJobId, onComplete }: Props) {
  const [jobId, setJobId] = useState<string | null>(pullProfileJobId);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>("PENDING");
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [retrying, setRetrying] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchSummary = useCallback(async () => {
    const fiscalYear = new Date().getFullYear();
    try {
      const [empRes, famRes, workRes, pdRes] = await Promise.all([
        fetch(`/api/empleadores?fiscalYear=${fiscalYear}`),
        fetch(`/api/datos-personales/cargas-familia?fiscalYear=${fiscalYear}`),
        fetch(`/api/trabajadores?fiscalYear=${fiscalYear}&count=true`),
        fetch(`/api/datos-personales?fiscalYear=${fiscalYear}`),
      ]);
      const [empData, famData, workData, pdData] = await Promise.all([
        empRes.json(),
        famRes.json(),
        workRes.json(),
        pdRes.json(),
      ]);
      setSummary({
        employers: empData.employers?.length ?? 0,
        familyDependents: famData.dependents?.length ?? 0,
        domesticWorkers: workData.count ?? 0,
        hasPersonalData: !!pdData.personalData,
      });
    } catch {
      // Best-effort
    }
  }, []);

  const connectToSSE = useCallback(
    (id: string) => {
      eventSourceRef.current?.close();
      const es = new EventSource(`/api/automatizacion/${id}/logs`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.step) setCurrentStep(data.step);
          if (data.done) {
            es.close();
            eventSourceRef.current = null;
            if (data.status === "COMPLETED") {
              fetchSummary().then(() => setJobStatus("COMPLETED"));
            } else {
              setJobStatus("FAILED");
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
    },
    [fetchSummary],
  );

  useEffect(() => {
    if (jobId) {
      // Check if the job already completed before we connect to SSE
      fetch(`/api/automatizacion/${jobId}`)
        .then((r) => r.json())
        .then(async (data) => {
          if (data.job?.status === "COMPLETED") {
            await fetchSummary();
            setJobStatus("COMPLETED");
          } else if (data.job?.status === "FAILED") {
            setJobStatus("FAILED");
          } else {
            setJobStatus("RUNNING");
            if (data.job?.currentStep) setCurrentStep(data.job.currentStep);
            connectToSSE(jobId);
          }
        })
        .catch(() => {
          // Fallback: try SSE anyway
          setJobStatus("RUNNING");
          connectToSSE(jobId);
        });
    } else {
      // No job — maybe profile was already pulled, check summary
      fetchSummary().then(() => setJobStatus("COMPLETED"));
    }
    return () => {
      eventSourceRef.current?.close();
    };
  }, [jobId, connectToSSE, fetchSummary]);

  async function handleRetry() {
    setRetrying(true);
    setJobStatus("PENDING");
    setCurrentStep(null);
    setSummary(null);
    try {
      const res = await fetch("/api/automatizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType: "PULL_PROFILE",
          fiscalYear: new Date().getFullYear(),
        }),
      });
      if (!res.ok) throw new Error();
      const { job } = await res.json();
      setJobId(job.id);
    } catch {
      toast.error("Error al reintentar");
      setJobStatus("FAILED");
    } finally {
      setRetrying(false);
    }
  }

  const isEmpty =
    summary &&
    !summary.hasPersonalData &&
    summary.employers === 0 &&
    summary.familyDependents === 0 &&
    summary.domesticWorkers === 0;

  // Auto-advance when profile pull completes with data
  useEffect(() => {
    if (jobStatus === "COMPLETED" && summary && !isEmpty) {
      const timer = setTimeout(() => onComplete(), 1500);
      return () => clearTimeout(timer);
    }
  }, [jobStatus, summary, isEmpty, onComplete]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 space-y-6 duration-500">
      <div className="text-center">
        <div className="bg-primary/10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
          <User className="text-primary h-7 w-7" />
        </div>
        <h2 className="text-xl font-semibold">Importando tu perfil impositivo</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Estamos extrayendo tus datos de ARCA automáticamente.
        </p>
      </div>

      {/* Progress */}
      {jobStatus !== "COMPLETED" && jobStatus !== "FAILED" && (
        <div className="bg-muted/50 rounded-xl p-4">
          <StepProgress
            steps={ONBOARDING_PROFILE_STEPS}
            currentStep={currentStep}
            status={jobStatus}
          />
        </div>
      )}

      {/* Success with summary */}
      {jobStatus === "COMPLETED" && summary && !isEmpty && (
        <div className="space-y-4">
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                Perfil importado
              </span>
            </div>
            <div className="text-muted-foreground space-y-1 text-xs">
              {summary.hasPersonalData && <p>Datos personales importados</p>}
              {summary.employers > 0 && (
                <p>
                  {summary.employers} empleador{summary.employers > 1 ? "es" : ""}
                </p>
              )}
              {summary.familyDependents > 0 && (
                <p>
                  {summary.familyDependents} carga{summary.familyDependents > 1 ? "s" : ""} de
                  familia
                </p>
              )}
              {summary.domesticWorkers > 0 && (
                <p>
                  {summary.domesticWorkers} trabajador{summary.domesticWorkers > 1 ? "es" : ""}{" "}
                  doméstico{summary.domesticWorkers > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty profile */}
      {jobStatus === "COMPLETED" && isEmpty && (
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground text-sm">
            No encontramos datos en tu perfil de ARCA. Podés completarlos manualmente.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1" asChild>
              <a href="/perfil" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Completar perfil
              </a>
            </Button>
            <Button className="flex-1" onClick={onComplete}>
              Continuar sin perfil
            </Button>
          </div>
        </div>
      )}

      {/* Failed */}
      {jobStatus === "FAILED" && (
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground text-sm">
            Hubo un error al importar tu perfil. Podés reintentar o continuar sin importar.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1" onClick={handleRetry} disabled={retrying}>
              {retrying ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Reintentar
            </Button>
            <Button className="flex-1" onClick={onComplete}>
              <SkipForward className="mr-2 h-4 w-4" />
              Omitir
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
