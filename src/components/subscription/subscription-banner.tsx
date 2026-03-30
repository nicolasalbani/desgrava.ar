"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface SubscriptionData {
  canWrite: boolean;
  status: string | null;
  plan: string | null;
  trialEndDate: string | null;
  currentPeriodEnd: string | null;
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function SubscriptionBanner() {
  const [data, setData] = useState<SubscriptionData | null>(null);

  useEffect(() => {
    fetch("/api/subscription")
      .then((res) => res.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  // Founders and active users — no banner
  if (data.plan === "FOUNDERS" || data.status === "ACTIVE") return null;

  // Expired or past due — show subscribe banner
  if (!data.canWrite) {
    return (
      <div className="border-border bg-background animate-in fade-in slide-in-from-top-1 flex items-center justify-between gap-4 border-b px-6 py-2 duration-700 ease-out">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-rose-400/80" />
          <p className="text-muted-foreground text-xs">
            Tu suscripción venció.{" "}
            <Link
              href="/configuracion"
              className="text-foreground font-medium underline underline-offset-2"
            >
              Suscribite
            </Link>{" "}
            para seguir usando todas las funcionalidades.
          </p>
        </div>
      </div>
    );
  }

  // Trialing — show days remaining if <= 10
  if (data.status === "TRIALING" && data.trialEndDate) {
    const daysLeft = getDaysUntil(data.trialEndDate);
    if (daysLeft > 10) return null;

    const isUrgent = daysLeft <= 3;
    return (
      <div className="border-border bg-background animate-in fade-in slide-in-from-top-1 flex items-center justify-between gap-4 border-b px-6 py-2 duration-700 ease-out">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              isUrgent ? "animate-pulse bg-rose-400/80" : "bg-amber-400/70",
            )}
          />
          <p className="text-muted-foreground text-xs">
            Tu prueba gratis vence el{" "}
            <span className="text-foreground font-medium">{formatDate(data.trialEndDate)}</span>.{" "}
            <span
              className={cn(
                isUrgent ? "text-rose-500 dark:text-rose-400" : "text-muted-foreground",
              )}
            >
              {daysLeft <= 0
                ? "Vence hoy."
                : daysLeft === 1
                  ? "Queda 1 día."
                  : `Quedan ${daysLeft} días.`}
            </span>{" "}
            <Link
              href="/configuracion"
              className="text-foreground font-medium underline underline-offset-2"
            >
              Suscribite ahora
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // Cancelled — show access end date
  if (data.status === "CANCELLED" && data.currentPeriodEnd) {
    return (
      <div className="border-border bg-background animate-in fade-in slide-in-from-top-1 flex items-center justify-between gap-4 border-b px-6 py-2 duration-700 ease-out">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/70" />
          <p className="text-muted-foreground text-xs">
            Tu suscripción fue cancelada. Tenés acceso hasta el{" "}
            <span className="text-foreground font-medium">{formatDate(data.currentPeriodEnd)}</span>
            .{" "}
            <Link
              href="/configuracion"
              className="text-foreground font-medium underline underline-offset-2"
            >
              Reactivar suscripción
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return null;
}
