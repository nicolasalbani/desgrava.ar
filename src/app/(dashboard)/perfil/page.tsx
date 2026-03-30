"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FamilyDependentsSection } from "@/components/perfil/family-dependents";
import { EmployersSection } from "@/components/perfil/employers-section";
import { PersonalDataSection } from "@/components/perfil/personal-data-section";
import { DomesticWorkersSection } from "@/components/trabajadores/domestic-workers-section";
import { useFiscalYear } from "@/contexts/fiscal-year";

const CURRENT_YEAR = new Date().getFullYear();

export default function PerfilPage() {
  const { fiscalYear } = useFiscalYear();
  const year = fiscalYear ?? CURRENT_YEAR;

  const [ownsProperty, setOwnsProperty] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/perfil-impositivo?year=${year}`)
      .then((res) => res.json())
      .then((data) => setOwnsProperty(data.ownsProperty ?? false))
      .finally(() => setLoading(false));
  }, [year]);

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
        <PersonalDataSection fiscalYear={year} />
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
        <EmployersSection fiscalYear={year} />
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
        <FamilyDependentsSection fiscalYear={year} />
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
        <DomesticWorkersSection fiscalYear={year} />
      </div>
    </div>
  );
}
