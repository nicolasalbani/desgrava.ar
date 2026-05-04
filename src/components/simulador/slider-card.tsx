"use client";

import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  HUE_CLASSES,
  SLIDER_MAX_MONTHLY,
  SLIDER_STEP,
  type SimuladorCategoryConfig,
} from "@/lib/simulador/category-config";
import { Home, HeartPulse, Stethoscope, GraduationCap, Key, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<SimuladorCategoryConfig["key"], LucideIcon> = {
  alquiler: Home,
  prepaga: HeartPulse,
  salud: Stethoscope,
  educacion: GraduationCap,
  hipotecario: Key,
  domestico: Sparkles,
};

function formatThousands(n: number): string {
  return n.toLocaleString("es-AR");
}

function formatBadge(annualDeducible: number): string {
  if (annualDeducible >= 1_000_000) {
    const millions = annualDeducible / 1_000_000;
    return `+$${millions.toFixed(millions >= 10 ? 0 : 1)}M`;
  }
  if (annualDeducible >= 1_000) {
    return `+$${Math.round(annualDeducible / 1_000)}k`;
  }
  return `+$${Math.round(annualDeducible)}`;
}

interface SliderCardProps {
  config: SimuladorCategoryConfig;
  value: number;
  onChange: (value: number) => void;
  /** Annual deductible for this category, computed from applyDeductionRules. */
  annualDeducible: number;
}

export function SliderCard({ config, value, onChange, annualDeducible }: SliderCardProps) {
  const Icon = ICONS[config.key];
  const hue = HUE_CLASSES[config.hue];
  const isZero = value === 0;
  const [inputValue, setInputValue] = useState(formatThousands(value));

  useEffect(() => {
    setInputValue(formatThousands(value));
  }, [value]);

  function handleInputChange(raw: string) {
    setInputValue(raw);
    const digits = raw.replace(/\D/g, "");
    const num = digits ? Math.min(Number(digits), SLIDER_MAX_MONTHLY) : 0;
    onChange(num);
  }

  function handleInputBlur() {
    setInputValue(formatThousands(value));
  }

  return (
    <div
      className={cn(
        "border-border bg-card rounded-2xl border p-4 transition-opacity",
        isZero && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              hue.iconBg,
            )}
          >
            <Icon className={cn("h-5 w-5", hue.iconText)} />
          </div>
          <div className="min-w-0">
            <p className="text-foreground text-sm font-medium">{config.label}</p>
            <p className="text-muted-foreground text-xs">{config.hint}</p>
          </div>
        </div>
        {!isZero && (
          <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 tabular-nums dark:text-emerald-400">
            {formatBadge(annualDeducible)}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-foreground text-xl font-semibold tabular-nums">$</span>
        <Input
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={handleInputBlur}
          aria-label={`Monto mensual de ${config.label}`}
          className="h-auto border-0 bg-transparent p-0 text-xl font-semibold tabular-nums shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <span className="text-muted-foreground shrink-0 text-xs">/mes</span>
      </div>

      <Slider
        className={cn("mt-3", hue.sliderRange, hue.sliderThumb)}
        value={[value]}
        min={0}
        max={SLIDER_MAX_MONTHLY}
        step={SLIDER_STEP}
        onValueChange={(values) => onChange(values[0] ?? 0)}
        aria-label={`Slider de ${config.label}`}
      />
    </div>
  );
}
