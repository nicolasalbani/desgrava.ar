import { describe, it, expect } from "vitest";
import {
  reverseLookupCategory,
  reverseLookupInvoiceType,
  SIRADIG_CATEGORY_MAP,
  SIRADIG_INVOICE_TYPE_MAP,
} from "@/lib/automation/deduction-mapper";
import {
  parseMonthValue,
  parseSiradigAmount,
  isAlquilerExtraction,
  isDomesticoExtraction,
  isStandardExtraction,
} from "@/lib/automation/siradig-navigator";
import type {
  ExtractedDeduction,
  ExtractedAlquilerDeduction,
  ExtractedDomesticoDeduction,
} from "@/lib/automation/siradig-navigator";

// ─── reverseLookupCategory ────────────────────────────────────────────

describe("reverseLookupCategory", () => {
  it.each([
    ["Cuotas Médico-Asistenciales", "CUOTAS_MEDICO_ASISTENCIALES"],
    ["Primas de Seguro para el caso de muerte/riesgo de muerte", "PRIMAS_SEGURO_MUERTE"],
    ["Gastos médicos y paramédicos", "GASTOS_MEDICOS"],
    ["Gastos Médicos y Paramédicos", "GASTOS_MEDICOS"],
    [
      "Indumentaria y Equipamiento para uso exclusivo en el lugar de trabajo",
      "GASTOS_INDUMENTARIA_TRABAJO",
    ],
    [
      "Beneficios para Locatarios (Inquilinos) - 40% (Ley I.G. Art. 85 inc. h)",
      "ALQUILER_VIVIENDA",
    ],
    ["Alquiler de inmuebles destinados a casa habitación", "ALQUILER_VIVIENDA"],
    ["Deducción del personal doméstico", "SERVICIO_DOMESTICO"],
    ["Gastos de Educación", "GASTOS_EDUCATIVOS"],
    ["Donaciones", "DONACIONES"],
    ["Gastos de sepelio", "GASTOS_SEPELIO"],
    ["Intereses préstamo hipotecario", "INTERESES_HIPOTECARIOS"],
  ])("maps '%s' to %s", (legendText, expected) => {
    expect(reverseLookupCategory(legendText)).toBe(expected);
  });

  it("is case-insensitive", () => {
    expect(reverseLookupCategory("GASTOS MÉDICOS Y PARAMÉDICOS")).toBe("GASTOS_MEDICOS");
    expect(reverseLookupCategory("gastos de educación")).toBe("GASTOS_EDUCATIVOS");
    expect(reverseLookupCategory("DONACIONES")).toBe("DONACIONES");
  });

  it("handles legend text with extra context (SiRADIG uses verbose legends)", () => {
    expect(
      reverseLookupCategory(
        "Gastos de Adquisición de Indumentaria y Equipamiento para uso exclusivo en el lugar de trabajo",
      ),
    ).toBe("GASTOS_INDUMENTARIA_TRABAJO");
    expect(reverseLookupCategory("Primas de Seguro para el caso de muerte")).toBe(
      "PRIMAS_SEGURO_MUERTE",
    );
  });

  it("returns undefined for unrecognized text", () => {
    expect(reverseLookupCategory("")).toBeUndefined();
    expect(reverseLookupCategory("Sección desconocida")).toBeUndefined();
    expect(reverseLookupCategory("Retenciones")).toBeUndefined();
  });

  it("does not map 'Otras deducciones' (should only be assigned manually)", () => {
    expect(reverseLookupCategory("Otras deducciones")).toBeUndefined();
    expect(reverseLookupCategory("Otras deducciones  +")).toBeUndefined();
  });

  it("maps all SIRADIG_CATEGORY_MAP values back to their enum key (except OTRAS_DEDUCCIONES)", () => {
    for (const [enumKey, displayText] of Object.entries(SIRADIG_CATEGORY_MAP)) {
      if (enumKey === "OTRAS_DEDUCCIONES") continue; // intentionally excluded from reverse lookup
      const result = reverseLookupCategory(displayText);
      expect(result, `Should map '${displayText}' back to '${enumKey}'`).toBe(enumKey);
    }
  });
});

// ─── reverseLookupInvoiceType ─────────────────────────────────────────

describe("reverseLookupInvoiceType", () => {
  it.each([
    ["Factura B", "FACTURA_B"],
    ["Factura C", "FACTURA_C"],
    ["Nota de Débito B", "NOTA_DEBITO_B"],
    ["Nota de Crédito B", "NOTA_CREDITO_B"],
    ["Recibo B", "RECIBO_B"],
    ["Recibo C", "RECIBO_C"],
    ["Tique-factura B", "TIQUE_FACTURA_B"],
    ["Otros comp. doc. exceptuados", "OTROS_EXCEPTUADOS"],
  ])("maps '%s' to %s", (typeText, expected) => {
    expect(reverseLookupInvoiceType(typeText)).toBe(expected);
  });

  it("is case-insensitive", () => {
    expect(reverseLookupInvoiceType("factura b")).toBe("FACTURA_B");
    expect(reverseLookupInvoiceType("FACTURA B")).toBe("FACTURA_B");
    expect(reverseLookupInvoiceType("recibo b")).toBe("RECIBO_B");
  });

  it("maps SiRADIG table text aliases (longer than dropdown text)", () => {
    expect(reverseLookupInvoiceType("Otros comprobantes documentos exceptuados")).toBe(
      "OTROS_EXCEPTUADOS",
    );
  });

  it("returns undefined for unknown types", () => {
    expect(reverseLookupInvoiceType("Unknown")).toBeUndefined();
    expect(reverseLookupInvoiceType("")).toBeUndefined();
  });

  it("maps all SIRADIG_INVOICE_TYPE_MAP values back to their enum key", () => {
    for (const [enumKey, displayText] of Object.entries(SIRADIG_INVOICE_TYPE_MAP)) {
      const result = reverseLookupInvoiceType(displayText);
      expect(result, `Should map '${displayText}' back to '${enumKey}'`).toBe(enumKey);
    }
  });
});

// ─── parseMonthValue ──────────────────────────────────────────────────

describe("parseMonthValue", () => {
  it("parses Spanish month names", () => {
    expect(parseMonthValue("Enero")).toBe(1);
    expect(parseMonthValue("Febrero")).toBe(2);
    expect(parseMonthValue("Marzo")).toBe(3);
    expect(parseMonthValue("Abril")).toBe(4);
    expect(parseMonthValue("Mayo")).toBe(5);
    expect(parseMonthValue("Junio")).toBe(6);
    expect(parseMonthValue("Julio")).toBe(7);
    expect(parseMonthValue("Agosto")).toBe(8);
    expect(parseMonthValue("Septiembre")).toBe(9);
    expect(parseMonthValue("Octubre")).toBe(10);
    expect(parseMonthValue("Noviembre")).toBe(11);
    expect(parseMonthValue("Diciembre")).toBe(12);
  });

  it("is case-insensitive", () => {
    expect(parseMonthValue("enero")).toBe(1);
    expect(parseMonthValue("DICIEMBRE")).toBe(12);
    expect(parseMonthValue("mArZo")).toBe(3);
  });

  it("parses numeric months", () => {
    expect(parseMonthValue("1")).toBe(1);
    expect(parseMonthValue("01")).toBe(1);
    expect(parseMonthValue("12")).toBe(12);
    expect(parseMonthValue("6")).toBe(6);
  });

  it("parses combined format '01 - Enero'", () => {
    expect(parseMonthValue("01 - Enero")).toBe(1);
    expect(parseMonthValue("07 - Julio")).toBe(7);
    expect(parseMonthValue("12 - Diciembre")).toBe(12);
  });

  it("handles whitespace", () => {
    expect(parseMonthValue("  Enero  ")).toBe(1);
    expect(parseMonthValue(" 5 ")).toBe(5);
  });

  it("returns 0 for invalid input", () => {
    expect(parseMonthValue("")).toBe(0);
    expect(parseMonthValue("abc")).toBe(0);
    expect(parseMonthValue("13")).toBe(0);
    expect(parseMonthValue("0")).toBe(0);
    expect(parseMonthValue("-1")).toBe(0);
  });
});

// ─── parseSiradigAmount ───────────────────────────────────────────────

describe("parseSiradigAmount", () => {
  it("parses dot-decimal format from comprobantes table", () => {
    expect(parseSiradigAmount("524399.00")).toBe("524399.00");
    expect(parseSiradigAmount("27000.00")).toBe("27000.00");
    expect(parseSiradigAmount("35787.00")).toBe("35787.00");
    expect(parseSiradigAmount("0.00")).toBe("0.00");
  });

  it("parses comma-decimal format from form fields", () => {
    expect(parseSiradigAmount("524399,00")).toBe("524399.00");
    expect(parseSiradigAmount("128000,00")).toBe("128000.00");
    expect(parseSiradigAmount("43200,00")).toBe("43200.00");
  });

  it("handles comma-decimal with dot thousands separators", () => {
    expect(parseSiradigAmount("1.234.567,89")).toBe("1234567.89");
    expect(parseSiradigAmount("52.439,90")).toBe("52439.90");
  });

  it("strips $ and whitespace", () => {
    expect(parseSiradigAmount("$ 524399.00")).toBe("524399.00");
    expect(parseSiradigAmount(" 27000.00 ")).toBe("27000.00");
  });

  it("returns '0' for empty input", () => {
    expect(parseSiradigAmount("")).toBe("0");
    expect(parseSiradigAmount("  ")).toBe("0");
  });
});

// ─── Type guard helpers ───────────────────────────────────────────────

describe("extraction type guards", () => {
  const standardEntry: ExtractedDeduction = {
    category: "GASTOS_MEDICOS",
    providerCuit: "20123456789",
    providerName: "Test Provider",
    periodoDesde: 1,
    periodoHasta: 12,
    montoTotal: "50000.00",
    comprobantes: [],
  };

  const alquilerEntry: ExtractedAlquilerDeduction = {
    category: "ALQUILER_VIVIENDA",
    providerCuit: "20123456789",
    providerName: "Test Locador",
    months: [{ month: 1, amount: "50000" }],
    comprobantes: [],
  };

  const domesticoEntry: ExtractedDomesticoDeduction = {
    category: "SERVICIO_DOMESTICO",
    workerCuil: "20123456789",
    workerName: "Test Worker",
    periodoDesde: 1,
    periodoHasta: 12,
    montoTotal: "80000.00",
    monthlyDetails: [],
  };

  describe("isAlquilerExtraction", () => {
    it("returns true for ALQUILER_VIVIENDA entries", () => {
      expect(isAlquilerExtraction(alquilerEntry)).toBe(true);
    });

    it("returns false for other entries", () => {
      expect(isAlquilerExtraction(standardEntry)).toBe(false);
      expect(isAlquilerExtraction(domesticoEntry)).toBe(false);
    });
  });

  describe("isDomesticoExtraction", () => {
    it("returns true for SERVICIO_DOMESTICO entries", () => {
      expect(isDomesticoExtraction(domesticoEntry)).toBe(true);
    });

    it("returns false for other entries", () => {
      expect(isDomesticoExtraction(standardEntry)).toBe(false);
      expect(isDomesticoExtraction(alquilerEntry)).toBe(false);
    });
  });

  describe("isStandardExtraction", () => {
    it("returns true for standard deduction entries", () => {
      expect(isStandardExtraction(standardEntry)).toBe(true);
    });

    it("returns false for alquiler and domestic entries", () => {
      expect(isStandardExtraction(alquilerEntry)).toBe(false);
      expect(isStandardExtraction(domesticoEntry)).toBe(false);
    });

    it("returns true for all standard categories", () => {
      const categories = [
        "GASTOS_MEDICOS",
        "PRIMAS_SEGURO_MUERTE",
        "GASTOS_INDUMENTARIA_TRABAJO",
        "GASTOS_EDUCATIVOS",
        "CUOTAS_MEDICO_ASISTENCIALES",
      ];
      for (const cat of categories) {
        const entry: ExtractedDeduction = { ...standardEntry, category: cat };
        expect(isStandardExtraction(entry), `${cat} should be standard`).toBe(true);
      }
    });
  });
});

// ─── Job steps ────────────────────────────────────────────────────────

describe("job steps include SiRADIG extraction", () => {
  // Import inline to avoid circular dependency issues
  it("PULL_COMPROBANTES runs SiRADIG extraction before ARCA download", async () => {
    const { JOB_TYPE_STEPS } = await import("@/lib/automation/job-steps");
    const steps = JOB_TYPE_STEPS.PULL_COMPROBANTES;
    const keys = steps.map((s) => s.key);
    expect(keys).toContain("siradig");
    expect(keys).toContain("siradig_extract");
    expect(keys).toContain("download");
    // SiRADIG extraction comes before ARCA download
    const siradigIdx = keys.indexOf("siradig");
    const extractIdx = keys.indexOf("siradig_extract");
    const downloadIdx = keys.indexOf("download");
    expect(extractIdx).toBeGreaterThan(siradigIdx);
    expect(downloadIdx).toBeGreaterThan(extractIdx);
  });

  it("PULL_DOMESTIC_RECEIPTS runs SiRADIG extraction before ARCA download", async () => {
    const { JOB_TYPE_STEPS } = await import("@/lib/automation/job-steps");
    const steps = JOB_TYPE_STEPS.PULL_DOMESTIC_RECEIPTS;
    const keys = steps.map((s) => s.key);
    expect(keys).toContain("siradig");
    expect(keys).toContain("siradig_extract");
    expect(keys).toContain("download");
    const siradigIdx = keys.indexOf("siradig");
    const extractIdx = keys.indexOf("siradig_extract");
    const downloadIdx = keys.indexOf("download");
    expect(extractIdx).toBeGreaterThan(siradigIdx);
    expect(downloadIdx).toBeGreaterThan(extractIdx);
  });
});
