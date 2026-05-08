"use client";

import { Loader2 } from "lucide-react";
import { useArcaImportProgress } from "@/hooks/use-arca-import-progress";

type Surface = "comprobantes" | "recibos" | "presentaciones";

interface QueuedJobsBannerProps {
  surface: Surface;
}

const RELEVANT_TYPES: Record<Surface, ReadonlyArray<string>> = {
  comprobantes: ["SUBMIT_INVOICE", "BULK_SUBMIT"],
  recibos: ["SUBMIT_DOMESTIC_DEDUCTION"],
  presentaciones: ["SUBMIT_PRESENTACION"],
};

const COPY: Record<Surface, string> = {
  comprobantes:
    "Tenés comprobantes esperando ser desgravados. Empezarán cuando termine la tarea actual.",
  recibos: "Tenés recibos esperando ser desgravados. Empezarán cuando termine la tarea actual.",
  presentaciones:
    "Tenés presentaciones esperando ser enviadas. Empezarán cuando termine la tarea actual.",
};

export function QueuedJobsBanner({ surface }: QueuedJobsBannerProps) {
  const { queueState } = useArcaImportProgress();

  // Only show when:
  // 1. Some other automation is RUNNING (otherwise the queued jobs are about
  //    to start themselves; no useful "esperando" message).
  // 2. At least one PENDING job for a type this page surfaces is in the queue.
  const isWaiting = queueState.hasQueuedWaiting && queueState.runningJobType !== null;
  if (!isWaiting) return null;

  const relevant = RELEVANT_TYPES[surface];
  const hasRelevantQueued = queueState.queuedJobTypes.some((t) => relevant.includes(t));
  if (!hasRelevantQueued) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-primary/[0.04] dark:bg-primary/10 border-primary/15 text-foreground flex items-start gap-3 rounded-lg border px-4 py-3"
    >
      <Loader2 className="text-primary mt-0.5 h-4 w-4 shrink-0 animate-spin" />
      <p className="text-sm leading-snug">{COPY[surface]}</p>
    </div>
  );
}
