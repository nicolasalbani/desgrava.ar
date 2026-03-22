"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Send, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useFiscalYear } from "@/contexts/fiscal-year";

type Status = "idle" | "running" | "completed" | "failed";

export function SubmitPresentacionDialog({
  open,
  onOpenChange,
  onSubmitComplete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmitComplete: () => void;
}) {
  const { fiscalYear } = useFiscalYear();
  const year = fiscalYear ?? new Date().getFullYear();

  const [status, setStatus] = useState<Status>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [logCount, setLogCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const connectedJobRef = useRef<string | null>(null);

  useEffect(() => {
    const container = logsContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (open && status !== "running") {
      setStatus("idle");
      setLogs([]);
      setLogCount(0);
    }
  }, [open, status]);

  const connectToSSE = useCallback(
    (jobId: string) => {
      if (connectedJobRef.current === jobId) return;

      eventSourceRef.current?.close();
      connectedJobRef.current = jobId;
      setStatus("running");

      const es = new EventSource(`/api/automatizacion/${jobId}/logs`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.log) {
            setLogCount((c) => c + 1);
            setLogs((prev) => [...prev.slice(-49), data.log]);
          }
          if (data.done) {
            es.close();
            eventSourceRef.current = null;
            connectedJobRef.current = null;
            if (data.status === "COMPLETED") {
              setStatus("completed");
              toast.success("Presentacion enviada al empleador");
              onSubmitComplete();
              setTimeout(() => onOpenChange(false), 1500);
            } else {
              setStatus("failed");
              toast.error("Error al enviar presentacion");
            }
          }
        } catch {
          // ignore
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        connectedJobRef.current = null;
        setStatus("failed");
        toast.error("Se perdio la conexion con el servidor");
      };
    },
    [onSubmitComplete],
  );

  async function handleStart() {
    setStatus("running");
    setLogs([]);
    setLogCount(0);

    try {
      const res = await fetch("/api/presentaciones/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiscalYear: year }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al iniciar envio");
      }

      const { job } = await res.json();
      connectToSSE(job.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar");
      setStatus("failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear nueva presentacion</DialogTitle>
          <DialogDescription>
            Se generara el formulario F.572 Web con todas las deducciones cargadas y se enviara al
            empleador via SiRADIG.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {status === "idle" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
                <Send className="text-muted-foreground h-6 w-6" />
              </div>
              <p className="text-muted-foreground text-center text-sm">
                Se descargara el borrador en PDF y luego se enviara la presentacion al empleador
                para el periodo {year}.
              </p>
              <Button onClick={handleStart}>
                <Send className="mr-2 h-4 w-4" />
                Enviar presentacion
              </Button>
            </div>
          )}

          {status === "running" && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500 dark:text-blue-400" />
                <span className="text-sm font-medium">Enviando presentacion...</span>
                {logCount > 0 && (
                  <span className="text-muted-foreground text-xs">({logCount} eventos)</span>
                )}
              </div>
              <div ref={logsContainerRef} className="bg-muted h-48 overflow-y-auto rounded-lg p-3">
                {logs.map((log, i) => (
                  <p key={i} className="text-muted-foreground text-xs leading-relaxed">
                    {log}
                  </p>
                ))}
              </div>
            </div>
          )}

          {status === "completed" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <p className="text-sm font-medium">Presentacion enviada exitosamente</p>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </div>
          )}

          {status === "failed" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <XCircle className="h-8 w-8 text-red-500" />
              <p className="text-sm font-medium">Error al enviar la presentacion</p>
              {logs.length > 0 && (
                <div className="bg-muted max-h-32 w-full overflow-y-auto rounded-lg p-3">
                  {logs.slice(-5).map((log, i) => (
                    <p key={i} className="text-muted-foreground text-xs leading-relaxed">
                      {log}
                    </p>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cerrar
                </Button>
                <Button onClick={handleStart}>Reintentar</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
