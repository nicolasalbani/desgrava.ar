"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { useFiscalYear } from "@/contexts/fiscal-year";

type ImportState = "idle" | "running" | "completed" | "failed";

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: number;
}

export function ImportArcaDialog({
  open,
  onOpenChange,
  onImportComplete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImportComplete?: () => void;
}) {
  const { fiscalYear } = useFiscalYear();
  const [state, setState] = useState<ImportState>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [_jobId, setJobId] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setState("idle");
      setLogs([]);
      setResult(null);
      setJobId(null);
    } else {
      cleanup();
    }
  }, [open, cleanup]);

  async function startImport() {
    if (!fiscalYear) {
      toast.error("Selecciona un año fiscal primero");
      return;
    }

    setState("running");
    setLogs([]);
    setResult(null);

    try {
      const res = await fetch("/api/automatizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType: "PULL_COMPROBANTES", fiscalYear }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const errorMsg = data?.error ?? "Error al iniciar la importación";
        toast.error(errorMsg);
        setState("failed");
        return;
      }

      const data = await res.json();
      const newJobId = data.job.id;
      setJobId(newJobId);

      // Start SSE connection
      const es = new EventSource(`/api/automatizacion/${newJobId}/logs`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.log) {
            setLogs((prev) => [...prev, payload.log]);
          }

          if (payload.done) {
            es.close();
            eventSourceRef.current = null;

            if (payload.status === "COMPLETED") {
              setState("completed");
              // Fetch final result from job
              fetch(`/api/automatizacion/${newJobId}`)
                .then((r) => r.json())
                .then((d) => {
                  if (d.job?.resultData) {
                    setResult(d.job.resultData as ImportResult);
                  }
                })
                .catch(() => {});
              onImportComplete?.();
            } else {
              setState("failed");
            }
          }
        } catch {
          // Ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        // Don't set failed — the job might still be running server-side
      };
    } catch {
      toast.error("Error de conexión al iniciar la importación");
      setState("failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar desde ARCA</DialogTitle>
          <DialogDescription>
            Importa automáticamente tus comprobantes recibidos desde el servicio &quot;Mis
            Comprobantes&quot; de ARCA para el año fiscal {fiscalYear ?? "seleccionado"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {state === "idle" && (
            <div className="space-y-3">
              <div className="bg-muted/40 rounded-xl p-4 text-sm">
                <p className="text-foreground/80 mb-2 font-medium">Esto va a:</p>
                <ul className="text-muted-foreground space-y-1.5 text-xs">
                  <li>1. Iniciar sesión en ARCA con tus credenciales guardadas</li>
                  <li>2. Ir a &quot;Mis Comprobantes&quot; → Comprobantes Recibidos</li>
                  <li>3. Buscar todos los comprobantes del año {fiscalYear}</li>
                  <li>4. Exportar como CSV e importar cada comprobante</li>
                  <li>5. Clasificar automáticamente la categoría de deducción con IA</li>
                </ul>
                <p className="text-muted-foreground/70 mt-3 text-xs">
                  Los comprobantes que ya tengas cargados no se van a duplicar.
                </p>
              </div>
              <Button onClick={startImport} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Iniciar importación
              </Button>
            </div>
          )}

          {state === "running" && <RunningView logs={logs} />}

          {state === "completed" && (
            <CompletedView result={result} onClose={() => onOpenChange(false)} />
          )}

          {state === "failed" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-rose-500" />
                <span className="text-sm font-medium">Error en la importación</span>
              </div>
              <LogPanel logs={logs} logsEndRef={logsEndRef} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                  Cerrar
                </Button>
                <Button onClick={startImport} className="flex-1">
                  Reintentar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Strip "[HH:MM:SS] " and "job:xxx " prefixes from log lines */
function cleanLog(log: string): string {
  return log.replace(/^\[[\d:]+\]\s*/, "").replace(/^\[job:\w+\]\s*/, "");
}

/** Parse progress from log lines like "Progreso: 170 importadas, 0 duplicadas, 0 errores (170/224)" */
function parseProgress(logs: string[]): {
  current: number;
  total: number;
  lastStatus: string;
} | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    const match = logs[i].match(/(\d+)\/(\d+)\)?$/);
    if (match) return { current: +match[1], total: +match[2], lastStatus: cleanLog(logs[i]) };
  }
  return null;
}

function RunningView({ logs }: { logs: string[] }) {
  const progress = parseProgress(logs);
  const lastLog = logs.length > 0 ? cleanLog(logs[logs.length - 1]) : "";
  const pct = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Loader2 className="text-primary h-4 w-4 animate-spin" />
            <span className="font-medium">Importando comprobantes...</span>
          </div>
          {progress && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {progress.current}/{progress.total}
            </span>
          )}
        </div>
        {progress && (
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
      <p className="text-muted-foreground truncate text-xs">{lastLog}</p>
    </div>
  );
}

function CompletedView({ result, onClose }: { result: ImportResult | null; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        <span className="text-sm font-medium">Importación completada</span>
      </div>
      {result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-semibold tabular-nums">{result.total}</p>
              <p className="text-muted-foreground text-xs">Encontrados</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
                {result.imported}
              </p>
              <p className="text-muted-foreground text-xs">Importados</p>
            </div>
            <div>
              <p className="text-foreground/50 text-2xl font-semibold tabular-nums">
                {result.skipped}
              </p>
              <p className="text-muted-foreground text-xs">Duplicados</p>
            </div>
            <div>
              <p
                className={`text-2xl font-semibold tabular-nums ${result.errors > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground/50"}`}
              >
                {result.errors}
              </p>
              <p className="text-muted-foreground text-xs">Errores</p>
            </div>
          </div>
        </div>
      )}
      <Button variant="outline" onClick={onClose} className="w-full">
        Cerrar
      </Button>
    </div>
  );
}

function LogPanel({
  logs,
  logsEndRef,
}: {
  logs: string[];
  logsEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (logs.length === 0) return null;

  return (
    <div className="bg-muted/30 max-h-40 overflow-y-auto rounded-lg p-3">
      <div className="space-y-0.5 font-mono text-[11px]">
        {logs.map((log, i) => (
          <p key={i} className="text-muted-foreground/70 leading-relaxed">
            {cleanLog(log)}
          </p>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
