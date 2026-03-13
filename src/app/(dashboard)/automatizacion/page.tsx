"use client";

import { useRef, useState } from "react";
import confetti from "canvas-confetti";
import { AutomationDashboard } from "@/components/automatizacion/automation-dashboard";
import { PendingInvoicesPanel } from "@/components/automatizacion/pending-invoices";
import { Sparkles } from "lucide-react";
import Link from "next/link";

function CelebrationBanner() {
  return (
    <div className="bg-primary/[0.04] border-primary/10 animate-in fade-in slide-in-from-bottom-2 flex items-start gap-4 rounded-2xl border px-6 py-5 duration-500">
      <div className="bg-primary/10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
        <Sparkles className="text-primary h-4 w-4" />
      </div>
      <div>
        <p className="text-foreground text-sm font-semibold">
          Tu primera deduccion fue enviada a SiRADIG
        </p>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Cada comprobante que cargas se convierte en plata de vuelta.{" "}
          <Link
            href="/facturas"
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Segui subiendo facturas
          </Link>{" "}
          — cuantas mas cargues, mayor es tu devolucion de impuestos.
        </p>
      </div>
    </div>
  );
}

export default function AutomatizacionPage() {
  const dashboardRefreshRef = useRef<(() => void) | null>(null);
  const pendingRefreshRef = useRef<(() => void) | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  function handleSubmitted() {
    dashboardRefreshRef.current?.();
  }

  function handleJobDeleted() {
    pendingRefreshRef.current?.();
  }

  function handleFirstJobCompleted() {
    setShowCelebration(true);
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.5 },
      colors: ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ffffff"],
    });
    setTimeout(() => {
      confetti({
        particleCount: 60,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ["#6366f1", "#8b5cf6", "#a78bfa"],
      });
      confetti({
        particleCount: 60,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ["#6366f1", "#8b5cf6", "#a78bfa"],
      });
    }, 200);
  }

  return (
    <div className="space-y-10">
      <div
        className="animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationFillMode: "backwards" }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">Enviar a SiRADIG</h1>
        <p className="text-muted-foreground/70 mt-1 text-sm">
          Carga tus deducciones directamente en SiRADIG
        </p>
      </div>

      {showCelebration && <CelebrationBanner />}

      <div
        className="animate-in fade-in slide-in-from-bottom-2 space-y-2 duration-500"
        style={{ animationDelay: "80ms", animationFillMode: "backwards" }}
      >
        <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          Facturas pendientes
        </h2>
        <PendingInvoicesPanel
          onSubmitted={handleSubmitted}
          onRegisterRefresh={(fn) => {
            pendingRefreshRef.current = fn;
          }}
        />
      </div>

      <div
        className="animate-in fade-in slide-in-from-bottom-2 space-y-2 duration-500"
        style={{ animationDelay: "160ms", animationFillMode: "backwards" }}
      >
        <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          Envios a SiRADIG
        </h2>
        <AutomationDashboard
          onRegisterRefresh={(fn) => {
            dashboardRefreshRef.current = fn;
          }}
          onFirstJobCompleted={handleFirstJobCompleted}
          onJobDeleted={handleJobDeleted}
        />
      </div>
    </div>
  );
}
