"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  deriveProximoPasoState,
  type ProximoPasoCardState,
  type ProximoPasoCta,
} from "@/lib/onboarding/proximo-paso-state";
import { useArcaImportProgress } from "@/hooks/use-arca-import-progress";
import { ArcaImportButton } from "@/components/shared/arca-import-button";

interface ProximoPasoCardProps {
  pendingInvoiceCount: number;
  pendingReceiptCount: number;
  totalDeducibleInvoices: number;
  totalDeducibleReceipts: number;
  hasUnregisteredWorker: boolean;
  allSubmitted: boolean;
  fiscalYear: number;
}

export function ProximoPasoCard({
  pendingInvoiceCount,
  pendingReceiptCount,
  totalDeducibleInvoices,
  totalDeducibleReceipts,
  hasUnregisteredWorker,
  allSubmitted,
  fiscalYear,
}: ProximoPasoCardProps) {
  const { snapshot } = useArcaImportProgress();
  const hasRunningImport = snapshot.hasRunning;

  const currentMonth = new Date().getMonth() + 1;
  const state: ProximoPasoCardState = deriveProximoPasoState({
    hasRunningImport,
    pendingInvoiceCount,
    pendingReceiptCount,
    totalDeducibleInvoices,
    totalDeducibleReceipts,
    hasUnregisteredWorker,
    allSubmitted,
    currentMonth,
  });

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
            <CtaButton key={i} cta={cta} fiscalYear={fiscalYear} />
          ))}
        </div>
      )}
    </div>
  );
}

function CtaButton({ cta, fiscalYear }: { cta: ProximoPasoCta; fiscalYear: number }) {
  if (cta.action === "import-comprobantes") {
    return (
      <ArcaImportButton
        mode="card"
        jobType="PULL_COMPROBANTES"
        fiscalYear={fiscalYear}
        label={cta.label}
        variant={cta.variant === "primary" ? "primary" : "secondary"}
      />
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
