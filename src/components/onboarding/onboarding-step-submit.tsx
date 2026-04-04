"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Send, Check } from "lucide-react";
import { StepProgress } from "@/components/shared/step-progress";
import type { StepDefinition } from "@/lib/automation/job-steps";

const ONBOARDING_SUBMIT_STEPS: StepDefinition[] = [
  { key: "login", label: "Iniciando sesión en ARCA" },
  { key: "siradig", label: "Abriendo SiRADIG" },
  { key: "fill", label: "Cargando deducción" },
];
import { CATEGORY_LABELS } from "@/lib/simulador/deduction-rules";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface Props {
  activeJobId?: string | null;
  onComplete: () => void;
}

interface InvoiceOption {
  id: string;
  providerName: string | null;
  providerCuit: string;
  amount: string;
  deductionCategory: string;
}

export function OnboardingStepSubmit({ activeJobId, onComplete }: Props) {
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // If there's an active submit job, resume it
    if (activeJobId) {
      setLoading(false);
      setSubmitting(true);
      fetch(`/api/automatizacion/${activeJobId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.job?.status === "COMPLETED") {
            setJobStatus("COMPLETED");
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
            setTimeout(() => onComplete(), 2000);
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
      return;
    }

    const fiscalYear = new Date().getFullYear();
    fetch(`/api/facturas?fiscalYear=${fiscalYear}&pageSize=20&excludeNoDeducible=true`)
      .then((r) => r.json())
      .then((data) => {
        const items: InvoiceOption[] = (data.invoices ?? []).map(
          (inv: {
            id: string;
            providerName: string | null;
            providerCuit: string;
            amount: string;
            deductionCategory: string;
          }) => ({
            id: inv.id,
            providerName: inv.providerName,
            providerCuit: inv.providerCuit,
            amount: inv.amount,
            deductionCategory: inv.deductionCategory,
          }),
        );
        setInvoices(items);
        if (items.length > 0) setSelectedId(items[0].id);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectToSSE = useCallback(
    (jobId: string) => {
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
            if (data.status === "COMPLETED") {
              setJobStatus("COMPLETED");
              // Fire confetti
              confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 },
              });
              // Wait a moment for confetti to show, then complete
              setTimeout(() => onComplete(), 2000);
            } else {
              setJobStatus("FAILED");
            }
          }
        } catch {
          // Ignore
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        setJobStatus("FAILED");
      };
    },
    [onComplete],
  );

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  async function handleSubmit() {
    if (!selectedId) return;
    setSubmitting(true);
    setJobStatus("RUNNING");
    setCurrentStep(null);
    try {
      const res = await fetch("/api/automatizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: selectedId,
          jobType: "SUBMIT_INVOICE",
        }),
      });
      if (!res.ok) throw new Error();
      const { job } = await res.json();
      connectToSSE(job.id);
    } catch {
      toast.error("Error al enviar deducción");
      setJobStatus("FAILED");
      setSubmitting(false);
    }
  }

  function formatAmount(amount: string) {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(parseFloat(amount));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
      </div>
    );
  }

  // Submitting or completed — show progress
  if (jobStatus) {
    return (
      <div className="animate-in fade-in space-y-6 duration-500">
        <div className="text-center">
          <div className="bg-primary/10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
            <Send className="text-primary h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold">
            {jobStatus === "COMPLETED"
              ? "¡Primera deducción enviada!"
              : jobStatus === "FAILED"
                ? "Error al enviar"
                : "Enviando deducción a SiRADIG"}
          </h2>
          {jobStatus === "COMPLETED" && (
            <p className="text-muted-foreground mt-1 text-sm">
              Tu deducción fue cargada en SiRADIG. Ya podés ver tu panel.
            </p>
          )}
        </div>

        {jobStatus !== "COMPLETED" && (
          <div className="bg-muted/50 rounded-xl p-4">
            <StepProgress
              steps={ONBOARDING_SUBMIT_STEPS}
              currentStep={currentStep}
              status={jobStatus}
            />
          </div>
        )}

        {jobStatus === "FAILED" && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setJobStatus(null);
                setSubmitting(false);
              }}
            >
              Reintentar
            </Button>
            <Button className="flex-1" onClick={onComplete}>
              Continuar al panel
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Selection state
  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 space-y-6 duration-500">
      <div className="text-center">
        <div className="bg-primary/10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
          <Send className="text-primary h-7 w-7" />
        </div>
        <h2 className="text-xl font-semibold">Enviá tu primera deducción</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Elegí un comprobante para enviar a SiRADIG y ver la magia en acción.
        </p>
      </div>

      <div className="max-h-[280px] space-y-2 overflow-y-auto">
        {invoices.map((inv) => {
          const isSelected = inv.id === selectedId;
          const label =
            CATEGORY_LABELS[inv.deductionCategory as keyof typeof CATEGORY_LABELS] ??
            inv.deductionCategory;
          return (
            <button
              key={inv.id}
              onClick={() => setSelectedId(inv.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/5 ring-primary/20 ring-2"
                  : "border-border hover:bg-muted/50",
              )}
            >
              <div
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  isSelected
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/30 bg-transparent",
                )}
              >
                {isSelected && <Check className="text-primary-foreground h-3 w-3" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {inv.providerName || inv.providerCuit}
                </p>
                <p className="text-muted-foreground truncate text-xs">{label}</p>
              </div>
              <span className="text-sm font-medium tabular-nums">{formatAmount(inv.amount)}</span>
            </button>
          );
        })}
      </div>

      <Button onClick={handleSubmit} disabled={!selectedId || submitting} className="w-full">
        <Send className="mr-2 h-4 w-4" />
        Desgravar
      </Button>
    </div>
  );
}
