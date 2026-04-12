"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useFiscalYear } from "@/contexts/fiscal-year";
import { cn } from "@/lib/utils";

// SiRADIG closes March 31 of the year following the fiscal year
function getDeadline(fiscalYear: number): Date {
  return new Date(fiscalYear + 1, 2, 31); // month is 0-indexed
}

function formatDeadline(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getDaysRemaining(deadline: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = deadline.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function DeadlineBanner() {
  const { fiscalYear } = useFiscalYear();
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || fiscalYear === null) return null;

  const deadline = getDeadline(fiscalYear);
  const daysRemaining = getDaysRemaining(deadline);

  // Only show within 60 days of deadline and before it passes
  if (daysRemaining > 60 || daysRemaining <= 0) return null;
  if (dismissed) return null;

  const isUrgent = daysRemaining <= 7;

  function dismiss() {
    setDismissed(true);
  }

  return (
    <div className="border-border bg-background animate-in fade-in slide-in-from-top-1 flex shrink-0 items-center justify-between gap-4 border-b px-6 py-2 duration-700 ease-out">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            isUrgent ? "animate-pulse bg-rose-400/80" : "bg-amber-400/70",
          )}
        />
        <p className="text-muted-foreground text-xs">
          Tenés hasta el{" "}
          <span className="text-foreground font-medium">{formatDeadline(deadline)}</span> para
          cargar o modificar desgravaciones del período fiscal{" "}
          <span className="text-foreground font-medium">{fiscalYear}</span>.{" "}
          <span
            className={cn(isUrgent ? "text-rose-500 dark:text-rose-400" : "text-muted-foreground")}
          >
            {daysRemaining === 1 ? "Queda 1 día." : `Quedan ${daysRemaining} días.`}
          </span>
        </p>
      </div>
      <button
        onClick={dismiss}
        aria-label="Cerrar"
        className="text-muted-foreground/40 hover:text-muted-foreground shrink-0 rounded-md p-0.5 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
