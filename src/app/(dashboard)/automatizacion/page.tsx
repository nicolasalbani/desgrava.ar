"use client";

import { useRef, useState, useEffect } from "react";
import confetti from "canvas-confetti";
import { AutomationDashboard } from "@/components/automatizacion/automation-dashboard";
import { PendingInvoicesPanel } from "@/components/automatizacion/pending-invoices";
import { Sparkles } from "lucide-react";
import Link from "next/link";

function CelebrationBanner() {
  return (
    <div className="rounded-2xl bg-primary/[0.04] border border-primary/10 px-6 py-5 flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          Tu primera deduccion fue enviada a SiRADIG
        </p>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Cada comprobante que cargas se convierte en plata de vuelta.{" "}
          <Link href="/facturas" className="text-primary underline-offset-4 hover:underline font-medium">
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
        <p className="text-sm text-muted-foreground/70 mt-1">
          Carga tus deducciones directamente en SiRADIG
        </p>
      </div>

      {showCelebration && <CelebrationBanner />}

      <div
        className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationDelay: "80ms", animationFillMode: "backwards" }}
      >
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Facturas pendientes
        </h2>
        <PendingInvoicesPanel
          onSubmitted={handleSubmitted}
          onRegisterRefresh={(fn) => { pendingRefreshRef.current = fn; }}
        />
      </div>

      <div
        className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationDelay: "160ms", animationFillMode: "backwards" }}
      >
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Envios a SiRADIG
        </h2>
        <AutomationDashboard
          onRegisterRefresh={(fn) => { dashboardRefreshRef.current = fn; }}
          onFirstJobCompleted={handleFirstJobCompleted}
          onJobDeleted={handleJobDeleted}
        />
      </div>
    </div>
  );
}
