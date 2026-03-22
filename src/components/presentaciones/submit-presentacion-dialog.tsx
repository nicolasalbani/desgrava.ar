"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [skipped, setSkipped] = useState(false);
  const skippedBoolRef = useRef(false);
  const [skipPrefLoaded, setSkipPrefLoaded] = useState(false);
  const skippedRef = useRef<string[]>([]);
  const autoStartedRef = useRef(false);
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

  // Fetch skip preference on mount
  useEffect(() => {
    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((data) => {
        const arr: string[] = data.preference?.skippedArcaDialogs ?? [];
        skippedRef.current = arr;
        const isSkipped = arr.includes("submit-presentacion");
        skippedBoolRef.current = isSkipped;
        setSkipped(isSkipped);
        setSkipPrefLoaded(true);
      })
      .catch(() => setSkipPrefLoaded(true));
  }, []);

  useEffect(() => {
    if (open && status !== "running") {
      setStatus("idle");
      setLogs([]);
      setLogCount(0);
      autoStartedRef.current = false;
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

  async function saveSkipPreference(checked: boolean) {
    setSkipped(checked);
    const key = "submit-presentacion";
    const updated = checked
      ? [...skippedRef.current.filter((k) => k !== key), key]
      : skippedRef.current.filter((k) => k !== key);
    skippedRef.current = updated;
    try {
      await fetch("/api/configuracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skippedArcaDialogs: updated }),
      });
    } catch {
      // Silently fail — preference is non-critical
    }
  }

  const handleStart = useCallback(async () => {
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
  }, [year, connectToSSE]);

  // Auto-start when skip preference is enabled (only on dialog open, not on checkbox change)
  useEffect(() => {
    if (
      open &&
      skipPrefLoaded &&
      skippedBoolRef.current &&
      status === "idle" &&
      !autoStartedRef.current
    ) {
      autoStartedRef.current = true;
      handleStart();
    }
  }, [open, skipPrefLoaded, status, handleStart]);

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
            <div className="space-y-3">
              <div className="bg-muted/40 rounded-xl p-4 text-sm">
                <p className="text-foreground/80 mb-2 font-medium">Esto va a:</p>
                <ul className="text-muted-foreground space-y-1.5 text-xs">
                  <li>1. Iniciar sesión en ARCA con tus credenciales guardadas</li>
                  <li>2. Ir a SiRADIG → Carga de Formulario → Vista Previa</li>
                  <li>3. Descargar el borrador del formulario en PDF</li>
                  <li>4. Enviar la presentación al empleador (&quot;Generar Presentación&quot;)</li>
                </ul>
                <p className="text-muted-foreground/70 mt-3 text-xs">
                  Se generará una nueva presentación para el periodo {year}.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="skip-submit"
                  checked={skipped}
                  onCheckedChange={(checked) => saveSkipPreference(checked === true)}
                />
                <label
                  htmlFor="skip-submit"
                  className="text-muted-foreground cursor-pointer text-xs"
                >
                  No volver a mostrar este mensaje
                </label>
              </div>
              <Button onClick={handleStart} className="w-full">
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
