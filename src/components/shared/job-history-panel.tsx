"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, ChevronDown, ChevronUp, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface JobEntry {
  id: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  logs: unknown;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  PENDING: { label: "Pendiente", dot: "bg-foreground/25" },
  RUNNING: { label: "Ejecutando", dot: "bg-blue-400/70" },
  COMPLETED: { label: "Completado", dot: "bg-emerald-400/80" },
  FAILED: { label: "Error", dot: "bg-rose-400/80" },
  CANCELLED: { label: "Cancelado", dot: "bg-foreground/20" },
};

interface JobHistoryPanelProps {
  entityId: string;
  entityType: "invoice" | "receipt";
  latestJobStatus?: string | null;
  onCancel?: (jobId: string) => void;
  cancelling?: boolean;
}

function LogsContainer({ logs }: { logs: string[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div ref={ref} className="bg-muted/30 max-h-32 space-y-0.5 overflow-y-auto rounded-md p-2">
      {logs.map((entry, i) => (
        <p key={i} className="text-muted-foreground text-[10px] leading-4">
          {entry}
        </p>
      ))}
    </div>
  );
}

export function JobHistoryPanel({
  entityId,
  entityType,
  latestJobStatus,
  onCancel,
  cancelling,
}: JobHistoryPanelProps) {
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const jobsRef = useRef(jobs);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    const param = entityType === "invoice" ? "invoiceId" : "receiptId";
    const url = `/api/automatizacion/history?${param}=${entityId}`;

    const fetchJobs = () =>
      fetch(url)
        .then((r) => r.json())
        .then((d) => setJobs(d.jobs ?? []))
        .catch(() => setJobs([]))
        .finally(() => setLoading(false));

    fetchJobs();

    // Poll every 3s while any job is in-flight
    const interval = setInterval(() => {
      const hasInFlight = jobsRef.current.some(
        (j) => j.status === "PENDING" || j.status === "RUNNING",
      );
      if (hasInFlight) fetchJobs();
    }, 3000);

    return () => clearInterval(interval);
  }, [entityId, entityType, latestJobStatus]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />
        <span className="text-muted-foreground text-xs">Cargando historial...</span>
      </div>
    );
  }

  if (jobs.length === 0) {
    return <p className="text-muted-foreground/50 py-3 text-xs">Sin envios previos a SiRADIG</p>;
  }

  return (
    <div className="space-y-1">
      <p className="text-muted-foreground mb-2 text-xs font-medium">
        Historial de envios ({jobs.length})
      </p>
      {jobs.map((job) => {
        const cfg = STATUS_CONFIG[job.status];
        const isExpanded = expandedJobId === job.id;
        const canCancel = job.status === "PENDING" || job.status === "RUNNING";
        const logs = Array.isArray(job.logs) ? (job.logs as string[]) : [];

        // Extract error summary from logs when errorMessage is missing
        let errorSummary = job.errorMessage;
        if (!errorSummary && job.status === "FAILED" && logs.length > 0) {
          // Look for the direct error message first (e.g. "Error al guardar: * CUIT/CUIL inválida")
          // then fall back to any "Error" log entry
          const stripTs = (l: string) => l.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, "");
          const direct = logs.find(
            (l) => l.includes("Error al guardar:") && !l.includes("deduccion para"),
          );
          const fallback = logs.findLast((l) => /Error/i.test(l));
          const match = direct ?? fallback;
          if (match) {
            errorSummary = stripTs(match);
          }
        }

        return (
          <div key={job.id} className="border-border/50 rounded-lg border">
            <button
              onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
              className="hover:bg-muted/30 flex w-full items-center gap-3 px-3 py-2 text-left transition-colors"
            >
              <span
                className={cn("h-1.5 w-1.5 shrink-0 rounded-full", cfg?.dot ?? "bg-foreground/25")}
              />
              <span className="text-foreground/70 flex-1 text-xs font-medium">
                {cfg?.label ?? job.status}
              </span>
              <span className="text-muted-foreground/50 text-xs">
                {new Date(job.createdAt).toLocaleString("es-AR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {isExpanded ? (
                <ChevronUp className="text-muted-foreground/40 h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="text-muted-foreground/40 h-3.5 w-3.5" />
              )}
            </button>

            {isExpanded && (
              <div className="border-border/50 space-y-2 border-t px-3 py-2">
                {errorSummary && (
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-rose-400" />
                    <p className="text-xs text-rose-400/90">{errorSummary}</p>
                  </div>
                )}

                {logs.length > 0 && <LogsContainer logs={logs} />}

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`/api/automatizacion/${job.id}`, "_blank");
                    }}
                  >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Detalle
                  </Button>
                  {canCancel && onCancel && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-6 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCancel(job.id);
                      }}
                      disabled={cancelling}
                    >
                      {cancelling ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
