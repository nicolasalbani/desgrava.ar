"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  deriveProximoPasoState,
  type ProximoPasoCardState,
  type ProximoPasoCta,
} from "@/lib/onboarding/proximo-paso-state";
import { useArcaImportProgress } from "@/hooks/use-arca-import-progress";

interface ProximoPasoCardProps {
  pendingCount: number;
  totalDeducible: number;
  allSubmitted: boolean;
  fiscalYear: number;
}

export function ProximoPasoCard({
  pendingCount,
  totalDeducible,
  allSubmitted,
  fiscalYear,
}: ProximoPasoCardProps) {
  const router = useRouter();
  const { snapshot } = useArcaImportProgress();
  const [importing, setImporting] = useState(false);

  const hasRunningImport = snapshot.hasRunning;
  const importPercent = hasRunningImport ? snapshot.percent : 0;

  const currentMonth = new Date().getMonth() + 1;
  const state: ProximoPasoCardState = deriveProximoPasoState({
    hasRunningImport,
    pendingCount,
    totalDeducible,
    allSubmitted,
    currentMonth,
  });

  async function handleImport() {
    setImporting(true);
    try {
      const res = await fetch("/api/automatizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType: "PULL_COMPROBANTES", fiscalYear }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "No se pudo iniciar la importación");
      }
      toast.success("Importación iniciada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div
      data-tour="proximo-paso"
      className="bg-card border-border animate-in fade-in slide-in-from-bottom-2 rounded-2xl border p-5 duration-500"
      style={{ animationDelay: "150ms", animationFillMode: "backwards" }}
    >
      <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase">
        Próximo paso
      </p>
      <h2 className="text-foreground text-lg font-semibold">{state.title}</h2>
      <p className="text-muted-foreground mt-1 mb-4 text-sm">{state.body}</p>

      {state.ctas.length > 0 && (
        <div className="flex flex-col gap-2">
          {state.ctas.map((cta, i) => (
            <CtaButton
              key={i}
              cta={cta}
              importing={importing}
              hasRunningImport={hasRunningImport}
              importPercent={importPercent}
              onImport={handleImport}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CtaButton({
  cta,
  importing,
  hasRunningImport,
  importPercent,
  onImport,
}: {
  cta: ProximoPasoCta;
  importing: boolean;
  hasRunningImport: boolean;
  importPercent: number;
  onImport: () => void;
}) {
  const variantClasses =
    cta.variant === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : "bg-card border border-border text-foreground hover:bg-muted";

  // For action-based CTAs that trigger the import, show progress fill if a job is running.
  if (cta.action === "import-comprobantes") {
    const disabled = hasRunningImport || importing;
    const label = hasRunningImport ? "Descargando…" : cta.label;
    return (
      <button
        type="button"
        onClick={onImport}
        disabled={disabled}
        aria-disabled={disabled}
        aria-label={
          hasRunningImport ? `Descargando comprobantes desde ARCA, ${importPercent}%` : cta.label
        }
        className={cn(
          "relative flex h-11 min-h-[44px] flex-1 items-center justify-center overflow-hidden rounded-md px-4 text-sm font-medium transition-colors",
          variantClasses,
          disabled && "cursor-not-allowed opacity-70",
        )}
      >
        {hasRunningImport && (
          <span
            className="bg-foreground/15 absolute inset-y-0 left-0 transition-all duration-700 ease-out"
            style={{ width: `${importPercent}%` }}
            aria-hidden="true"
          />
        )}
        <span className="relative">{label}</span>
      </button>
    );
  }

  if (cta.href) {
    return (
      <Button
        asChild
        variant={cta.variant === "primary" ? "default" : "outline"}
        className="min-h-[44px] flex-1"
      >
        <Link href={cta.href}>{cta.label}</Link>
      </Button>
    );
  }

  return null;
}
