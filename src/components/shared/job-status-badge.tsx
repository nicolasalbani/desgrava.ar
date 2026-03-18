"use client";

import { cn } from "@/lib/utils";

export interface LatestJob {
  id: string;
  status: string;
  createdAt: string;
  errorMessage: string | null;
}

const JOB_STATUS_CONFIG: Record<string, { label: string; dot: string; animate?: boolean }> = {
  PENDING: { label: "Pendiente", dot: "bg-foreground/25" },
  RUNNING: { label: "Ejecutando", dot: "bg-blue-400/70", animate: true },
  COMPLETED: { label: "Completado", dot: "bg-emerald-400/80" },
  FAILED: { label: "Error", dot: "bg-rose-400/80" },
  CANCELLED: { label: "Cancelado", dot: "bg-foreground/20" },
};

export function JobStatusBadge({ job }: { job: LatestJob | null }) {
  if (!job) {
    return <span className="text-muted-foreground/40 text-xs">No enviado</span>;
  }

  const cfg = JOB_STATUS_CONFIG[job.status];
  return (
    <span className="inline-flex items-center gap-1.5" title={job.errorMessage ?? undefined}>
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          cfg?.dot ?? "bg-foreground/25",
          cfg?.animate && "animate-pulse",
        )}
      />
      <span className="text-foreground/70 text-xs font-medium">{cfg?.label ?? job.status}</span>
    </span>
  );
}
