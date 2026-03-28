"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Minus } from "lucide-react";
import { SimuladorResults } from "./simulador-results";
import { simulateSimplified, type SimplifiedSimulationResult } from "@/lib/simulador/calculator";
import { TAX_TABLES_2025 } from "@/lib/simulador/tax-tables";

const limits = TAX_TABLES_2025.deductionLimits;

interface CategoryField {
  key: string;
  label: string;
  description: string;
  annualCap: string;
  category: string;
}

const CATEGORY_FIELDS: CategoryField[] = [
  {
    key: "alquiler",
    label: "Alquiler",
    description: "Alquiler de vivienda",
    annualCap: `40% deducible, tope anual $${limits.alquilerVivienda.annualMax.toNumber().toLocaleString("es-AR")}`,
    category: "ALQUILER_VIVIENDA",
  },
  {
    key: "prepaga",
    label: "Prepaga",
    description: "Cuotas Médico-Asistenciales",
    annualCap: "100% deducible, tope 5% del ingreso neto",
    category: "CUOTAS_MEDICO_ASISTENCIALES",
  },
  {
    key: "salud",
    label: "Salud",
    description: "Gastos médicos y paramédicos",
    annualCap: "40% deducible, tope 5% del ingreso neto",
    category: "GASTOS_MEDICOS",
  },
  {
    key: "educacion",
    label: "Educación",
    description: "Gastos educativos",
    annualCap: `Tope anual $${limits.gastosEducativos.annualMax.toNumber().toLocaleString("es-AR")}`,
    category: "GASTOS_EDUCATIVOS",
  },
  {
    key: "hipotecario",
    label: "Intereses préstamo hipotecario",
    description: "Crédito hipotecario para vivienda",
    annualCap: `Tope anual $${limits.interesesHipotecarios.annualMax.toNumber().toLocaleString("es-AR")}`,
    category: "INTERESES_HIPOTECARIOS",
  },
  {
    key: "domestico",
    label: "Personal doméstico",
    description: "Casas particulares",
    annualCap: `Tope anual $${limits.servicioDomestico.annualMax.toNumber().toLocaleString("es-AR")}`,
    category: "SERVICIO_DOMESTICO",
  },
];

function formatArgNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("es-AR");
}

function unformatArgNumber(value: string): string {
  return value.replace(/\D/g, "");
}

function PesoInput({
  value,
  onChange,
  placeholder = "0",
}: {
  value: string;
  onChange: (raw: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="text-muted-foreground/60 absolute top-1/2 left-3 -translate-y-1/2 text-sm select-none">
        $
      </span>
      <Input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={formatArgNumber(value)}
        onChange={(e) => onChange(unformatArgNumber(e.target.value))}
        className="pl-7 text-right tabular-nums"
      />
    </div>
  );
}

export function SimuladorForm() {
  const [tieneHijos, setTieneHijos] = useState(0);
  const [tieneConyuge, setTieneConyuge] = useState(false);
  const [isMonthly, setIsMonthly] = useState(true);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SimplifiedSimulationResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  function updateAmount(key: string, raw: string) {
    setAmounts((prev) => ({ ...prev, [key]: raw }));
  }

  // Auto-calculate with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const deducciones = CATEGORY_FIELDS.filter((f) => {
        const raw = amounts[f.key];
        return raw && parseFloat(raw) > 0;
      }).map((f) => ({
        category: f.category,
        amount: parseFloat(amounts[f.key]) * (isMonthly ? 12 : 1),
      }));

      const hasInput = deducciones.length > 0 || tieneConyuge || tieneHijos > 0;

      if (!hasInput) {
        setResult(null);
        return;
      }

      const res = simulateSimplified({
        tieneHijos,
        tieneConyuge,
        esPropietario: false,
        interesesHipotecariosMensual: 0,
        deducciones,
      });
      setResult(res);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [tieneHijos, tieneConyuge, isMonthly, amounts]);

  return (
    <div className="space-y-10">
      {/* Family situation */}
      <div className="space-y-4">
        <h3 className="text-foreground text-sm font-medium">Situacion familiar</h3>
        <div className="border-border flex flex-wrap items-center gap-x-8 gap-y-4 border-b pb-5">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-sm">Hijos a cargo</Label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                disabled={tieneHijos <= 0}
                onClick={() => setTieneHijos(Math.max(0, tieneHijos - 1))}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="text-foreground w-8 text-center text-sm font-medium tabular-nums">
                {tieneHijos}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                disabled={tieneHijos >= 20}
                onClick={() => setTieneHijos(Math.min(20, tieneHijos + 1))}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end pb-0.5">
            <Switch id="conyuge" checked={tieneConyuge} onCheckedChange={setTieneConyuge} />
            <Label htmlFor="conyuge" className="cursor-pointer text-sm">
              Conyuge a cargo
            </Label>
          </div>
        </div>
      </div>

      {/* Deduction categories */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-foreground text-sm font-medium">
            Gastos deducibles {isMonthly ? "mensuales" : "anuales"}
          </h3>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs ${!isMonthly ? "text-foreground font-medium" : "text-muted-foreground"}`}
            >
              Anual
            </span>
            <Switch
              id="periodo"
              checked={isMonthly}
              onCheckedChange={setIsMonthly}
              aria-label="Alternar entre montos mensuales y anuales"
            />
            <span
              className={`text-xs ${isMonthly ? "text-foreground font-medium" : "text-muted-foreground"}`}
            >
              Mensual
            </span>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {CATEGORY_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-foreground text-sm font-medium">{field.label}</Label>
              <p className="text-muted-foreground text-xs">{field.description}</p>
              <PesoInput
                value={amounts[field.key] ?? ""}
                onChange={(raw) => updateAmount(field.key, raw)}
              />
              <p className="text-muted-foreground/70 text-[11px]">{field.annualCap}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      {result && <SimuladorResults result={result} />}
    </div>
  );
}
