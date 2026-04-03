"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Download, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getStepsForJobType } from "@/lib/automation/job-steps";

interface PersonalData {
  id: string;
  apellido: string;
  nombre: string;
  dirCalle: string;
  dirNro: string;
  dirPiso: string | null;
  dirDpto: string | null;
  descProvincia: string;
  localidad: string;
  codPostal: string;
}

export function PersonalDataSection({
  fiscalYear,
  readOnly,
}: {
  fiscalYear: number;
  readOnly?: boolean;
}) {
  const [data, setData] = useState<PersonalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importStep, setImportStep] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  // Data loading
  useEffect(() => {
    setLoading(true);
    fetch(`/api/datos-personales?year=${fiscalYear}`)
      .then((r) => r.json())
      .then((d) => setData(d.personalData ?? null))
      .catch(() => toast.error("Error al cargar datos personales"))
      .finally(() => setLoading(false));
  }, [fiscalYear]);

  // SSE for import
  const connectToJobSSE = useCallback(
    (jobId: string) => {
      eventSourceRef.current?.close();

      const es = new EventSource(`/api/automatizacion/${jobId}/logs`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.step) setImportStep(msg.step);

          if (msg.done) {
            es.close();
            eventSourceRef.current = null;

            if (msg.status === "COMPLETED") {
              fetch(`/api/datos-personales?year=${fiscalYear}`)
                .then((r) => r.json())
                .then((d) => {
                  setData(d.personalData ?? null);
                  setHighlighted(true);
                  setTimeout(() => setHighlighted(false), 3000);
                });
              toast.success("Datos personales importados desde SiRADIG");
            } else {
              toast.error("Error al importar datos personales");
            }
            setImporting(false);
            setImportStep(null);
          }
        } catch {
          /* ignore */
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        setImporting(false);
        setImportStep(null);
        toast.error("Se perdió la conexión con el servidor");
      };
    },
    [fiscalYear],
  );

  // Active job recovery
  useEffect(() => {
    let cancelled = false;

    async function checkActiveJob() {
      try {
        const res = await fetch("/api/automatizacion");
        if (!res.ok) return;
        const { jobs } = await res.json();
        const activeJob = jobs.find(
          (j: { jobType: string; fiscalYear?: number | null; status: string }) =>
            j.jobType === "PULL_PERSONAL_DATA" &&
            j.fiscalYear === fiscalYear &&
            (j.status === "PENDING" || j.status === "RUNNING"),
        );
        if (activeJob && !cancelled) {
          setImporting(true);
          if (activeJob.currentStep) setImportStep(activeJob.currentStep);
          connectToJobSSE(activeJob.id);
        }
      } catch {
        /* best-effort */
      }
    }

    checkActiveJob();
    return () => {
      cancelled = true;
    };
  }, [fiscalYear, connectToJobSSE]);

  // Import handler
  async function handleImport() {
    setImporting(true);
    setImportStep(null);

    try {
      const res = await fetch("/api/automatizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType: "PULL_PERSONAL_DATA", fiscalYear }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error al iniciar importación");
      }

      const { job } = await res.json();
      connectToJobSSE(job.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al importar";
      toast.error(msg);
      setImporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="text-muted-foreground/60 h-5 w-5 animate-spin" />
      </div>
    );
  }

  const cardClass = highlighted
    ? "border-border bg-card rounded-xl border p-4 transition-all duration-300 border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
    : "border-border bg-card rounded-xl border p-4 transition-all duration-300";

  return (
    <>
      {/* Action button */}
      <div>
        <Button variant="outline" size="sm" onClick={handleImport} disabled={importing || readOnly}>
          {importing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-3.5 w-3.5" />
          )}
          Importar desde SiRADIG
        </Button>
      </div>

      {/* Import progress */}
      {importing && importStep && (
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <Loader2 className="h-3 w-3 animate-spin" />
          {getStepsForJobType("PULL_PERSONAL_DATA").find((s) => s.key === importStep)?.label ??
            importStep}
        </p>
      )}

      {/* Data display */}
      {!data && !importing ? (
        <div className="text-muted-foreground/60 flex flex-col items-center gap-2 py-8 text-center text-sm">
          <User className="h-8 w-8 opacity-40" />
          <p>No hay datos personales importados para este periodo</p>
        </div>
      ) : data ? (
        <div className={cardClass}>
          <div className="space-y-4">
            {/* Apellido y Nombre */}
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                Apellido y Nombre
              </p>
              <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                <Field label="Apellido" value={data.apellido} />
                <Field label="Nombre" value={data.nombre} />
              </div>
            </div>

            {/* Domicilio */}
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                Domicilio
              </p>
              <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                <Field label="Calle" value={data.dirCalle} />
                <div className="flex gap-3">
                  <Field label="Nro" value={data.dirNro} />
                  {data.dirPiso && <Field label="Piso" value={data.dirPiso} />}
                  {data.dirDpto && <Field label="Dpto" value={data.dirDpto} />}
                </div>
                <Field label="Provincia" value={data.descProvincia} />
                <Field label="Localidad" value={data.localidad} />
                <Field label="Código Postal" value={data.codPostal} />
              </div>
            </div>
          </div>

          {highlighted && (
            <span className="mt-3 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              actualizado
            </span>
          )}
        </div>
      ) : null}
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
