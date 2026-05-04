"use client";

import { cn } from "@/lib/utils";
import { PERSONA_PRESETS, type PersonaPresetId } from "@/lib/simulador/personas";

interface PersonaPresetsProps {
  selectedId: PersonaPresetId | null;
  onSelect: (id: PersonaPresetId) => void;
}

export function PersonaPresets({ selectedId, onSelect }: PersonaPresetsProps) {
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        Empezá con un ejemplo
      </p>
      <div className="flex flex-wrap gap-2">
        {PERSONA_PRESETS.map((preset) => {
          const selected = preset.id === selectedId;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect(preset.id)}
              className={cn(
                "flex min-h-[36px] items-center rounded-full border px-4 text-sm transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted",
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
