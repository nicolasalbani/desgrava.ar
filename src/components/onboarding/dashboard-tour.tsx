"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";
import Link from "next/link";
import { Spotlight } from "./spotlight";
import { useArcaImportProgress } from "@/hooks/use-arca-import-progress";

type Phase = "welcome" | "spotlight-1" | "spotlight-2" | "spotlight-3" | "spotlight-4" | "done";

interface SpotlightStep {
  selector: string;
  fallbackSelector?: string;
  title: string;
  body: string;
}

const SPOTLIGHT_STEPS: SpotlightStep[] = [
  {
    selector: '[data-tour="metrics-row"]',
    title: "Tus métricas, de un vistazo",
    body: "Acá ves cuánto deduciste, tu ahorro estimado y el estado de tus comprobantes y recibos del año fiscal.",
  },
  {
    selector: '[data-tour="proximo-paso"]',
    title: "Tu próximo paso",
    body: "Te indicamos qué hacer ahora: revisar comprobantes, importarlos desde ARCA o presentar a SiRADIG.",
  },
  {
    selector: '[data-tour="comprobantes-recientes"]',
    title: "Comprobantes recientes",
    body: "Mirá los últimos comprobantes deducibles del año, con su estado y monto.",
  },
  {
    selector: '[data-tour="nav-presentaciones"]',
    fallbackSelector: '[data-tour="nav-presentaciones-mobile"]',
    title: "Presentaciones a SiRADIG",
    body: "Desde acá enviás tu F.572 web a tu empleador. El agente de retención usa esta información para liquidar tu Ganancias.",
  },
];

export function DashboardTour({
  fiscalYear,
  firstName,
}: {
  fiscalYear: number;
  firstName: string;
}) {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [dismissed, setDismissed] = useState(false);
  const { snapshot, summary } = useArcaImportProgress();
  const searchParams = useSearchParams();
  // On replay, the post-onboarding import counts are stale — skip the summary modal.
  const isReplay = searchParams.get("replay") === "1";

  const persistComplete = useCallback(async () => {
    try {
      await fetch("/api/tour/complete", { method: "POST" });
    } catch {
      // Best-effort — the tour will retry next visit if this fails.
    }
  }, []);

  const handleSkip = useCallback(() => {
    persistComplete();
    setDismissed(true);
  }, [persistComplete]);

  const handleStart = useCallback(() => {
    setPhase("spotlight-1");
  }, []);

  const handleNext = useCallback(() => {
    setPhase((p) => {
      if (p === "spotlight-1") return "spotlight-2";
      if (p === "spotlight-2") return "spotlight-3";
      if (p === "spotlight-3") return "spotlight-4";
      if (p === "spotlight-4") {
        if (isReplay) {
          // Replay: dismiss without showing the (stale) summary.
          persistComplete();
          setDismissed(true);
          return p;
        }
        return "done";
      }
      return p;
    });
  }, [isReplay, persistComplete]);

  const handlePrev = useCallback(() => {
    setPhase((p) => {
      if (p === "spotlight-4") return "spotlight-3";
      if (p === "spotlight-3") return "spotlight-2";
      if (p === "spotlight-2") return "spotlight-1";
      return p;
    });
  }, []);

  const handleFinish = useCallback(() => {
    persistComplete();
    setDismissed(true);
  }, [persistComplete]);

  // Confetti when the completion modal opens.
  useEffect(() => {
    if (phase === "done") {
      const t = setTimeout(() => {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.5 },
          disableForReducedMotion: true,
        });
      }, 200);
      return () => clearTimeout(t);
    }
  }, [phase]);

  if (dismissed) return null;

  // Welcome modal
  if (phase === "welcome") {
    return (
      <Dialog
        open={true}
        onOpenChange={(open) => {
          if (!open) handleSkip();
        }}
      >
        <DialogContent
          className="max-w-full gap-0 overflow-hidden p-0 sm:max-w-md"
          showCloseButton={false}
        >
          {/* Top section with dot pattern + Ganancio portrait card */}
          <div
            className="from-muted/40 to-background relative bg-gradient-to-b px-6 pt-10 pb-8"
            style={{
              backgroundImage: "radial-gradient(circle, rgb(0 0 0 / 0.07) 1px, transparent 1.5px)",
              backgroundSize: "16px 16px",
              backgroundPosition: "center",
            }}
          >
            <div className="bg-card border-border ring-border/50 mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border shadow-md ring-1">
              <Image
                src="/ganancio.png"
                alt="Ganancio"
                width={112}
                height={112}
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          {/* Body */}
          <div className="space-y-5 px-6 pt-6 pb-6">
            <DialogHeader className="space-y-3">
              <p className="text-primary flex items-center justify-center gap-1.5 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                Bienvenida
              </p>
              <DialogTitle className="text-center text-xl font-semibold sm:text-2xl">
                Hola {firstName}, me llamo Ganancio <span aria-hidden="true">👋</span>
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-center text-sm leading-relaxed">
                Mientras traemos tus datos desde <strong className="text-foreground">ARCA</strong>{" "}
                para el año fiscal <strong className="text-foreground">{fiscalYear}</strong>, te
                muestro el panel en <strong className="text-foreground">menos de un minuto</strong>.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex flex-col gap-3 sm:flex-col">
              <Button onClick={handleStart} size="lg" className="w-full">
                Arrancar el tour
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <button
                type="button"
                onClick={handleSkip}
                className="text-muted-foreground hover:text-foreground w-full text-center text-sm transition-colors"
              >
                Saltar, ya entiendo cómo funciona
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Spotlights
  if (
    phase === "spotlight-1" ||
    phase === "spotlight-2" ||
    phase === "spotlight-3" ||
    phase === "spotlight-4"
  ) {
    const idx = ["spotlight-1", "spotlight-2", "spotlight-3", "spotlight-4"].indexOf(phase);
    const step = SPOTLIGHT_STEPS[idx];
    return (
      <Spotlight
        key={phase}
        selector={step.selector}
        fallbackSelector={step.fallbackSelector}
        title={step.title}
        body={step.body}
        stepIndex={idx}
        totalSteps={SPOTLIGHT_STEPS.length}
        onPrev={idx > 0 ? handlePrev : undefined}
        onNext={handleNext}
        onSkip={handleSkip}
        isLast={idx === SPOTLIGHT_STEPS.length - 1}
      />
    );
  }

  // Completion modal
  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) handleFinish();
      }}
    >
      <DialogContent className="max-w-full sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-center text-xl">¡Listo!</DialogTitle>
          <DialogDescription className="text-center">
            {snapshot.allDone
              ? "Ya terminé de traer tus datos de ARCA. Esto es lo que importé:"
              : "Sigo trayendo el resto en segundo plano."}
          </DialogDescription>
        </DialogHeader>

        {snapshot.allDone ? (
          <div className="space-y-2 text-sm">
            <SummaryRow
              count={summary.invoices}
              label={summary.invoices === 1 ? "comprobante importado" : "comprobantes importados"}
              href="/comprobantes"
            />
            <SummaryRow
              count={summary.receipts}
              label={
                summary.receipts === 1
                  ? "recibo salarial importado"
                  : "recibos salariales importados"
              }
              href="/recibos"
            />
            <SummaryRow
              count={summary.presentaciones}
              label={
                summary.presentaciones === 1 ? "presentación traída" : "presentaciones traídas"
              }
              href="/presentaciones"
            />
          </div>
        ) : (
          <p className="text-muted-foreground text-center text-sm">
            Estado actual:{" "}
            <span className="text-foreground font-medium">{snapshot.stageLabel}</span>
          </p>
        )}

        <DialogFooter>
          <Button onClick={handleFinish} className="w-full">
            Listo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ count, label, href }: { count: number; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="border-border hover:bg-muted flex items-center justify-between rounded-lg border px-3 py-2 transition-colors"
    >
      <span>
        <span className="text-foreground font-semibold tabular-nums">{count}</span>{" "}
        <span className="text-muted-foreground">{label}</span>
      </span>
      <span className="text-primary text-xs">Ver →</span>
    </Link>
  );
}
