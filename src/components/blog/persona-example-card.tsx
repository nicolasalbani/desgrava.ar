import { Home, HeartPulse, Stethoscope, GraduationCap, Key, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getPreset, type PersonaPresetId } from "@/lib/simulador/personas";
import {
  SIMULADOR_CATEGORIES,
  HUE_CLASSES,
  type SimuladorCategoryKey,
} from "@/lib/simulador/category-config";
import { cn } from "@/lib/utils";

const ICONS: Record<SimuladorCategoryKey, LucideIcon> = {
  alquiler: Home,
  prepaga: HeartPulse,
  salud: Stethoscope,
  educacion: GraduationCap,
  hipotecario: Key,
  domestico: Sparkles,
};

interface PersonaExampleCardProps {
  persona: PersonaPresetId;
  ahorroAnualAproximado: number;
}

function formatMoney(value: number): string {
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function PersonaExampleCard({ persona, ahorroAnualAproximado }: PersonaExampleCardProps) {
  const preset = getPreset(persona);
  const filledCategories = SIMULADOR_CATEGORIES.filter((c) => {
    const monto = preset.montos[c.key];
    return typeof monto === "number" && monto > 0;
  });

  return (
    <div className="border-border bg-card not-prose my-8 rounded-2xl border p-5 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Caso ilustrativo
          </p>
          <h3 className="text-foreground mt-1 text-lg font-semibold tracking-tight md:text-xl">
            {preset.label}
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {preset.tieneConyuge ? "En pareja" : "Solo/a"}
            {preset.tieneHijos > 0
              ? ` · ${preset.tieneHijos} ${preset.tieneHijos === 1 ? "hijo" : "hijos"}`
              : ""}
          </p>
        </div>
        <div className="border-border bg-background rounded-xl border p-4 sm:min-w-[180px] sm:text-right">
          <p className="text-muted-foreground text-xs">Podría recuperar al año</p>
          <p className="text-foreground mt-0.5 text-2xl font-bold tracking-tight">
            {formatMoney(ahorroAnualAproximado)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">aprox.</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Gastos mensuales
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {filledCategories.map((c) => {
            const Icon = ICONS[c.key];
            const hue = HUE_CLASSES[c.hue];
            const monto = preset.montos[c.key] ?? 0;
            return (
              <li
                key={c.key}
                className="border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
              >
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      hue.iconBg,
                    )}
                  >
                    <Icon className={cn("h-4 w-4", hue.iconText)} />
                  </span>
                  <span className="text-foreground text-sm font-medium">{c.label}</span>
                </span>
                <span className="text-foreground text-sm font-semibold tabular-nums">
                  {formatMoney(monto)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-muted-foreground border-border mt-5 border-t pt-4 text-xs leading-relaxed">
        Ejemplo orientativo basado en costos típicos de CABA en 2026 y la escala vigente del
        Impuesto a las Ganancias. Tu caso real depende de tu sueldo y tus gastos —{" "}
        <a href="/simulador" className="text-primary hover:underline">
          calculá el tuyo en el simulador
        </a>
        .
      </p>
    </div>
  );
}
