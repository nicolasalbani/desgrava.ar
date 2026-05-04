"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Minus } from "lucide-react";
import { SimuladorResults, SimuladorMobileHero, SimuladorMobileCta } from "./simulador-results";
import { PersonaPresets } from "./persona-presets";
import { SliderCard } from "./slider-card";
import { simulateSimplified, type SimplifiedSimulationResult } from "@/lib/simulador/calculator";
import { SIMULADOR_CATEGORIES } from "@/lib/simulador/category-config";
import { DEFAULT_PERSONA_ID, getPreset, type PersonaPresetId } from "@/lib/simulador/personas";
import type { SimuladorCategoryKey } from "@/lib/simulador/category-config";

type Amounts = Record<SimuladorCategoryKey, number>;

function emptyAmounts(): Amounts {
  return {
    alquiler: 0,
    prepaga: 0,
    salud: 0,
    educacion: 0,
    hipotecario: 0,
    domestico: 0,
  };
}

function amountsForPreset(id: PersonaPresetId): Amounts {
  const preset = getPreset(id);
  const a = emptyAmounts();
  for (const cat of SIMULADOR_CATEGORIES) {
    a[cat.key] = preset.montos[cat.key] ?? 0;
  }
  return a;
}

export function SimuladorForm() {
  const initialPreset = getPreset(DEFAULT_PERSONA_ID);
  const [selectedPresetId, setSelectedPresetId] = useState<PersonaPresetId | null>(
    DEFAULT_PERSONA_ID,
  );
  const [tieneHijos, setTieneHijos] = useState(initialPreset.tieneHijos);
  const [tieneConyuge, setTieneConyuge] = useState(initialPreset.tieneConyuge);
  const [amounts, setAmounts] = useState<Amounts>(() => amountsForPreset(DEFAULT_PERSONA_ID));

  function clearPreset() {
    setSelectedPresetId(null);
  }

  function updateAmount(key: SimuladorCategoryKey, value: number) {
    setAmounts((prev) => ({ ...prev, [key]: value }));
    clearPreset();
  }

  function updateHijos(value: number) {
    setTieneHijos(value);
    clearPreset();
  }

  function updateConyuge(value: boolean) {
    setTieneConyuge(value);
    clearPreset();
  }

  function applyPreset(id: PersonaPresetId) {
    const preset = getPreset(id);
    setSelectedPresetId(id);
    setTieneHijos(preset.tieneHijos);
    setTieneConyuge(preset.tieneConyuge);
    setAmounts(amountsForPreset(id));
  }

  const result: SimplifiedSimulationResult = useMemo(() => {
    const deducciones = SIMULADOR_CATEGORIES.filter((c) => amounts[c.key] > 0).map((c) => ({
      category: c.category,
      amount: amounts[c.key] * 12,
    }));
    return simulateSimplified({
      tieneHijos,
      tieneConyuge,
      esPropietario: false,
      interesesHipotecariosMensual: 0,
      deducciones,
    });
  }, [amounts, tieneHijos, tieneConyuge]);

  const annualDeducibleByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of result.detalleDeduciones) {
      map[row.category] = parseFloat(row.deductibleAmount);
    }
    return map;
  }, [result]);

  return (
    <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,400px)] md:gap-8 lg:gap-10">
      {/* Mobile sticky hero — appears at top on mobile only */}
      <div className="md:hidden">
        <SimuladorMobileHero result={result} />
      </div>

      {/* Left column: inputs */}
      <div className="space-y-5">
        <PersonaPresets selectedId={selectedPresetId} onSelect={applyPreset} />

        <FamilyCard
          tieneHijos={tieneHijos}
          tieneConyuge={tieneConyuge}
          onHijosChange={updateHijos}
          onConyugeChange={updateConyuge}
        />

        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Tus gastos deducibles mensuales
          </p>
          <p className="text-muted-foreground text-xs">
            Movelos a cualquier categoría — el recibo se actualiza al instante
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {SIMULADOR_CATEGORIES.map((cat) => (
            <SliderCard
              key={cat.key}
              config={cat}
              value={amounts[cat.key]}
              onChange={(v) => updateAmount(cat.key, v)}
              annualDeducible={annualDeducibleByCategory[cat.category] ?? 0}
            />
          ))}
        </div>

        <p className="text-muted-foreground text-xs">
          Estimación informativa. La devolución exacta depende de tu liquidación anual del SiRADIG /
          F.572.
        </p>
      </div>

      {/* Right column: desktop sticky panel */}
      <aside className="mt-8 hidden md:sticky md:top-24 md:mt-0 md:block md:self-start">
        <SimuladorResults result={result} />
      </aside>

      {/* Mobile sticky bottom CTA */}
      <div className="md:hidden">
        <SimuladorMobileCta result={result} />
      </div>
    </div>
  );
}

function FamilyCard({
  tieneHijos,
  tieneConyuge,
  onHijosChange,
  onConyugeChange,
}: {
  tieneHijos: number;
  tieneConyuge: boolean;
  onHijosChange: (n: number) => void;
  onConyugeChange: (v: boolean) => void;
}) {
  return (
    <div className="border-border bg-card rounded-2xl border p-4">
      <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        Tu situación
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <Label className="text-foreground text-sm">Hijos a cargo</Label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={tieneHijos <= 0}
              onClick={() => onHijosChange(Math.max(0, tieneHijos - 1))}
              aria-label="Quitar un hijo"
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
              onClick={() => onHijosChange(Math.min(20, tieneHijos + 1))}
              aria-label="Sumar un hijo"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="border-border hidden h-6 w-px bg-current opacity-20 sm:block" />

        <div className="flex items-center gap-3">
          <Switch id="conyuge" checked={tieneConyuge} onCheckedChange={onConyugeChange} />
          <Label htmlFor="conyuge" className="cursor-pointer text-sm">
            Cónyuge a cargo
          </Label>
        </div>
      </div>
    </div>
  );
}
