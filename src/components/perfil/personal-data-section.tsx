"use client";

import { useState, useEffect } from "react";
import { Loader2, User } from "lucide-react";
import { toast } from "sonner";

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
  refreshKey,
}: {
  fiscalYear: number;
  readOnly?: boolean;
  refreshKey?: number;
}) {
  const [data, setData] = useState<PersonalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [highlighted, setHighlighted] = useState(false);

  // Data loading
  useEffect(() => {
    setLoading(true);
    fetch(`/api/datos-personales?year=${fiscalYear}`)
      .then((r) => r.json())
      .then((d) => setData(d.personalData ?? null))
      .catch(() => toast.error("Error al cargar datos personales"))
      .finally(() => setLoading(false));
  }, [fiscalYear]);

  // Re-fetch when compound import completes
  useEffect(() => {
    if (!refreshKey) return;
    fetch(`/api/datos-personales?year=${fiscalYear}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d.personalData ?? null);
        setHighlighted(true);
        setTimeout(() => setHighlighted(false), 3000);
      });
  }, [refreshKey, fiscalYear]);

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

  if (!data) {
    return (
      <div className="text-muted-foreground/60 flex flex-col items-center gap-2 py-8 text-center text-sm">
        <User className="h-8 w-8 opacity-40" />
        <p>No hay datos personales importados para este periodo</p>
      </div>
    );
  }

  return (
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
