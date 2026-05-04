import { describe, it, expect } from "vitest";
import {
  PERSONA_PRESETS,
  DEFAULT_PERSONA_ID,
  getPreset,
  type PersonaPresetId,
} from "@/lib/simulador/personas";
import { SIMULADOR_CATEGORIES } from "@/lib/simulador/category-config";
import { simulateSimplified } from "@/lib/simulador/calculator";

function presetToSimulationInput(id: PersonaPresetId) {
  const preset = getPreset(id);
  const deducciones = SIMULADOR_CATEGORIES.filter((c) => (preset.montos[c.key] ?? 0) > 0).map(
    (c) => ({
      category: c.category,
      amount: (preset.montos[c.key] ?? 0) * 12,
    }),
  );
  return {
    tieneHijos: preset.tieneHijos,
    tieneConyuge: preset.tieneConyuge,
    esPropietario: false,
    interesesHipotecariosMensual: 0,
    deducciones,
  };
}

describe("PERSONA_PRESETS", () => {
  it("includes all 5 expected presets in display order", () => {
    const ids = PERSONA_PRESETS.map((p) => p.id);
    expect(ids).toEqual([
      "familia-tipo",
      "soltero-inquilino",
      "familia-casa-propia",
      "profesional-hijos-colegio",
      "personalizado",
    ]);
  });

  it("lists Familia tipo first so it's the visible default", () => {
    expect(PERSONA_PRESETS[0]?.id).toBe("familia-tipo");
  });

  it("has unique ids", () => {
    const ids = PERSONA_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only references valid category keys", () => {
    const validKeys = new Set(SIMULADOR_CATEGORIES.map((c) => c.key));
    for (const preset of PERSONA_PRESETS) {
      for (const key of Object.keys(preset.montos)) {
        expect(validKeys.has(key as never)).toBe(true);
      }
    }
  });

  it("uses non-negative monthly amounts", () => {
    for (const preset of PERSONA_PRESETS) {
      for (const amount of Object.values(preset.montos)) {
        expect(amount).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("DEFAULT_PERSONA_ID", () => {
  it("points to an existing preset", () => {
    expect(() => getPreset(DEFAULT_PERSONA_ID)).not.toThrow();
  });

  it('defaults to "familia-tipo" so the simulator opens with realistic numbers', () => {
    expect(DEFAULT_PERSONA_ID).toBe("familia-tipo");
  });
});

describe("getPreset()", () => {
  it("returns the matching preset", () => {
    expect(getPreset("soltero-inquilino").label).toBe("Soltero inquilino");
  });

  it("throws on unknown id", () => {
    expect(() => getPreset("does-not-exist" as PersonaPresetId)).toThrow();
  });
});

describe("preset payloads produce non-zero results", () => {
  it.each([
    "soltero-inquilino",
    "familia-tipo",
    "familia-casa-propia",
    "profesional-hijos-colegio",
  ] as PersonaPresetId[])('persona "%s" yields a positive ahorroAnualHasta', (id) => {
    const input = presetToSimulationInput(id);
    const result = simulateSimplified(input);
    expect(parseFloat(result.ahorroAnualHasta)).toBeGreaterThan(0);
  });

  it('persona "personalizado" zeroes everything (no deducciones, no family)', () => {
    const input = presetToSimulationInput("personalizado");
    expect(input.tieneHijos).toBe(0);
    expect(input.tieneConyuge).toBe(false);
    expect(input.deducciones).toHaveLength(0);
    const result = simulateSimplified(input);
    expect(parseFloat(result.ahorroAnualHasta)).toBe(0);
  });
});
