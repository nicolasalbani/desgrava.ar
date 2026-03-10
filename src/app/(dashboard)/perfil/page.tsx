"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FamilyDependentsSection } from "@/components/perfil/family-dependents";
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
    <div className="space-y-10 max-w-xl">
      <div
        className="animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationFillMode: "backwards" }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Perfil impositivo</h1>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
            {year}
          </span>
        </div>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Tu situacion personal y familiar para el calculo de deducciones
        </p>
      </div>

      {/* Situacion personal */}
      <div
        className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationDelay: "80ms", animationFillMode: "backwards" }}
      >
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ownsProperty">Soy titular de un inmueble</Label>
              <p className="text-xs text-muted-foreground/60">
                Activar si sos propietario de un inmueble en cualquier proporcion. Determina el beneficio de alquiler aplicable (10% Art. 85 inc. k vs. 40% Art. 85 inc. h).
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
        className="border-t border-border animate-in fade-in duration-500"
        style={{ animationDelay: "160ms", animationFillMode: "backwards" }}
      />

      {/* Cargas de Familia */}
      <div
        className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationDelay: "160ms", animationFillMode: "backwards" }}
      >
        <div>
          <h2 className="text-base font-semibold">Cargas de Familia</h2>
          <p className="text-sm text-muted-foreground/70 mt-0.5">
            Declara tus dependientes familiares para que se descuenten de tu base imponible
          </p>
        </div>
        <FamilyDependentsSection fiscalYear={year} />
      </div>
    </div>
  );
}
