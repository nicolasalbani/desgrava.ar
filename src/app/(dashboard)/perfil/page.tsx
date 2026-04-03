"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { FamilyDependentsSection } from "@/components/perfil/family-dependents";
import { EmployersSection } from "@/components/perfil/employers-section";
import { PersonalDataSection } from "@/components/perfil/personal-data-section";
import { DomesticWorkersSection } from "@/components/trabajadores/domestic-workers-section";
import { useFiscalYear } from "@/contexts/fiscal-year";
import { useFiscalYearReadOnly } from "@/hooks/use-fiscal-year-read-only";
import { getStepsForJobType } from "@/lib/automation/job-steps";

const CURRENT_YEAR = new Date().getFullYear();

export default function PerfilPage() {
  const { fiscalYear } = useFiscalYear();
  const year = fiscalYear ?? CURRENT_YEAR;
  const readOnly = useFiscalYearReadOnly();

  const [ownsProperty, setOwnsProperty] = useState(false);
  const [loading, setLoading] = useState(true);

  // Compound import state
  const [profileImporting, setProfileImporting] = useState(false);
  const [profileStep, setProfileStep] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/perfil-impositivo?year=${year}`)
      .then((res) => res.json())
      .then((data) => setOwnsProperty(data.ownsProperty ?? false))
      .finally(() => setLoading(false));
  }, [year]);

  const connectToProfileSSE = useCallback((jobId: string) => {
    eventSourceRef.current?.close();

    const es = new EventSource(`/api/automatizacion/${jobId}/logs`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.step) setProfileStep(msg.step);

        if (msg.done) {
          es.close();
          eventSourceRef.current = null;

          if (msg.status === "COMPLETED") {
            toast.success("Perfil impositivo importado desde ARCA");
            setRefreshKey((k) => k + 1);
          } else {
            toast.error("Error al importar perfil impositivo");
          }
          setProfileImporting(false);
          setProfileStep(null);
        }
      } catch {
        /* ignore */
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setProfileImporting(false);
      setProfileStep(null);
      toast.error("Se perdió la conexión con el servidor");
    };
  }, []);

  // Active PULL_PROFILE job recovery
  useEffect(() => {
    let cancelled = false;

    async function checkActiveJob() {
      try {
        const res = await fetch("/api/automatizacion");
        if (!res.ok) return;
        const { jobs } = await res.json();
        const activeJob = jobs.find(
          (j: { jobType: string; fiscalYear?: number | null; status: string }) =>
            j.jobType === "PULL_PROFILE" &&
            j.fiscalYear === year &&
            (j.status === "PENDING" || j.status === "RUNNING"),
        );
        if (activeJob && !cancelled) {
          setProfileImporting(true);
          if (activeJob.currentStep) setProfileStep(activeJob.currentStep);
          connectToProfileSSE(activeJob.id);
        }
      } catch {
        /* best-effort */
      }
    }

    checkActiveJob();
    return () => {
      cancelled = true;
    };
  }, [year, connectToProfileSSE]);

  async function handleProfileImport() {
    setProfileImporting(true);
    setProfileStep(null);

    try {
      const res = await fetch("/api/automatizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType: "PULL_PROFILE", fiscalYear: year }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error al iniciar importación");
      }

      const { job } = await res.json();
      connectToProfileSSE(job.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al importar";
      toast.error(msg);
      setProfileImporting(false);
    }
  }

  async function handleOwnsPropertyToggle(checked: boolean) {
    setOwnsProperty(checked);
    try {
      const res = await fetch("/api/perfil-impositivo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, ownsProperty: checked }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setOwnsProperty(!checked);
      toast.error("Error al guardar la configuracion");
    }
  }

  return (
    <div className="w-full max-w-xl space-y-10">
      <div
        className="animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationFillMode: "backwards" }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Perfil impositivo</h1>
          <span className="bg-muted text-muted-foreground border-border rounded-full border px-2 py-0.5 text-xs font-medium">
            {year}
          </span>
        </div>
        <p className="text-muted-foreground/70 mt-1 text-sm">
          Tu situacion personal y familiar para el calculo de deducciones
        </p>

        {/* Compound import button */}
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleProfileImport}
            disabled={profileImporting || readOnly}
            className="min-h-[44px] w-full sm:w-auto"
          >
            {profileImporting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            Importar todo desde ARCA
          </Button>
        </div>

        {/* Compound import progress */}
        {profileImporting && profileStep && (
          <p className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            {getStepsForJobType("PULL_PROFILE").find((s) => s.key === profileStep)?.label ??
              profileStep}
          </p>
        )}
      </div>

      {/* Situacion personal */}
      <div
        className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-500"
        style={{ animationDelay: "80ms", animationFillMode: "backwards" }}
      >
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="text-muted-foreground/60 h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ownsProperty">Soy titular de un inmueble</Label>
              <p className="text-muted-foreground/60 text-xs">
                Activar si sos propietario de un inmueble en cualquier proporcion. Determina el
                beneficio de alquiler aplicable (10% Art. 85 inc. k vs. 40% Art. 85 inc. h).
              </p>
            </div>
            <Switch
              id="ownsProperty"
              checked={ownsProperty}
              onCheckedChange={handleOwnsPropertyToggle}
              disabled={readOnly}
            />
          </div>
        )}
      </div>

      <div
        className="border-border animate-in fade-in border-t duration-500"
        style={{ animationDelay: "160ms", animationFillMode: "backwards" }}
      />

      {/* Datos Personales */}
      <div
        className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-500"
        style={{ animationDelay: "160ms", animationFillMode: "backwards" }}
      >
        <div>
          <h2 className="text-base font-semibold">Datos Personales</h2>
          <p className="text-muted-foreground/70 mt-0.5 text-sm">
            Tu información personal registrada en ARCA/SiRADIG
          </p>
        </div>
        <PersonalDataSection
          fiscalYear={year}
          readOnly={readOnly}
          profileImporting={profileImporting}
          refreshKey={refreshKey}
        />
      </div>

      <div
        className="border-border animate-in fade-in border-t duration-500"
        style={{ animationDelay: "200ms", animationFillMode: "backwards" }}
      />

      {/* Empleadores */}
      <div
        className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-500"
        style={{ animationDelay: "200ms", animationFillMode: "backwards" }}
      >
        <div>
          <h2 className="text-base font-semibold">Empleadores</h2>
          <p className="text-muted-foreground/70 mt-0.5 text-sm">
            Tus empleadores para el periodo fiscal seleccionado
          </p>
        </div>
        <EmployersSection
          fiscalYear={year}
          readOnly={readOnly}
          profileImporting={profileImporting}
          refreshKey={refreshKey}
        />
      </div>

      <div
        className="border-border animate-in fade-in border-t duration-500"
        style={{ animationDelay: "280ms", animationFillMode: "backwards" }}
      />

      {/* Cargas de Familia */}
      <div
        className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-500"
        style={{ animationDelay: "280ms", animationFillMode: "backwards" }}
      >
        <div>
          <h2 className="text-base font-semibold">Cargas de Familia</h2>
          <p className="text-muted-foreground/70 mt-0.5 text-sm">
            Declara tus dependientes familiares para que se descuenten de tu base imponible
          </p>
        </div>
        <FamilyDependentsSection
          fiscalYear={year}
          readOnly={readOnly}
          profileImporting={profileImporting}
          refreshKey={refreshKey}
        />
      </div>

      <div
        className="border-border animate-in fade-in border-t duration-500"
        style={{ animationDelay: "360ms", animationFillMode: "backwards" }}
      />

      {/* Trabajadores a cargo */}
      <div
        className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-500"
        style={{ animationDelay: "360ms", animationFillMode: "backwards" }}
      >
        <div>
          <h2 className="text-base font-semibold">Trabajadores a cargo</h2>
          <p className="text-muted-foreground/70 mt-0.5 text-sm">
            Personal de casas particulares para deducir en SiRADIG
          </p>
        </div>
        <DomesticWorkersSection
          fiscalYear={year}
          readOnly={readOnly}
          profileImporting={profileImporting}
          refreshKey={refreshKey}
        />
      </div>
    </div>
  );
}
