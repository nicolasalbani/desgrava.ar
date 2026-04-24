import { describe, it, expect } from "vitest";
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  DEDUCTION_CATEGORIES,
  ALL_DEDUCTION_CATEGORIES,
  INVOICE_TYPES,
  getInvoiceNumberFormat,
  invoiceNumberMatchesType,
  type InvoiceType,
} from "@/lib/validators/invoice";

const VALID_CUIT = "20-27395860-7";

const validInvoice = {
  deductionCategory: "CUOTAS_MEDICO_ASISTENCIALES" as const,
  providerCuit: VALID_CUIT,
  invoiceType: "FACTURA_B" as const,
  amount: 15000.5,
  fiscalYear: 2025,
  fiscalMonth: 6,
};

describe("createInvoiceSchema", () => {
  it("should accept a valid invoice with all required fields", () => {
    const result = createInvoiceSchema.safeParse(validInvoice);
    expect(result.success).toBe(true);
  });

  it("should accept a valid invoice with all optional fields included", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      providerName: "Clinica San Martin",
      invoiceNumber: "00001-00000123",
      invoiceDate: "2025-06-15",
      description: "Consulta medica",
      contractStartDate: "2025-01-01",
      contractEndDate: "2025-12-31",
    });
    expect(result.success).toBe(true);
  });

  it("should accept all valid deduction categories", () => {
    for (const category of DEDUCTION_CATEGORIES) {
      const data =
        category === "ALQUILER_VIVIENDA"
          ? {
              ...validInvoice,
              deductionCategory: category,
              contractStartDate: "2025-01-01",
              contractEndDate: "2025-12-31",
            }
          : { ...validInvoice, deductionCategory: category };
      const result = createInvoiceSchema.safeParse(data);
      expect(result.success, `Category ${category} should be valid`).toBe(true);
    }
  });

  it("should reject an invalid deduction category", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      deductionCategory: "INVALID_CATEGORY",
    });
    expect(result.success).toBe(false);
  });

  it("should reject NO_DEDUCIBLE as a user-selectable category", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      deductionCategory: "NO_DEDUCIBLE",
    });
    expect(result.success).toBe(false);
  });

  it("should accept all valid invoice types", () => {
    for (const type of INVOICE_TYPES) {
      const result = createInvoiceSchema.safeParse({
        ...validInvoice,
        invoiceType: type,
      });
      expect(result.success, `Invoice type ${type} should be valid`).toBe(true);
    }
  });

  it("should reject an invalid invoice type", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      invoiceType: "FACTURA_Z",
    });
    expect(result.success).toBe(false);
  });

  it("should reject a negative amount", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      amount: -500,
    });
    expect(result.success).toBe(false);
  });

  it("should reject zero amount", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      amount: 0,
    });
    expect(result.success).toBe(false);
  });

  it("should coerce string amounts to numbers", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      amount: "5000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(5000);
    }
  });

  it("should reject fiscal year below 2020", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      fiscalYear: 2019,
    });
    expect(result.success).toBe(false);
  });

  it("should reject fiscal year above 2030", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      fiscalYear: 2031,
    });
    expect(result.success).toBe(false);
  });

  it("should accept boundary fiscal years (2020 and 2030)", () => {
    expect(createInvoiceSchema.safeParse({ ...validInvoice, fiscalYear: 2020 }).success).toBe(true);
    expect(createInvoiceSchema.safeParse({ ...validInvoice, fiscalYear: 2030 }).success).toBe(true);
  });

  it("should reject fiscal month below 1", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      fiscalMonth: 0,
    });
    expect(result.success).toBe(false);
  });

  it("should reject fiscal month above 12", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      fiscalMonth: 13,
    });
    expect(result.success).toBe(false);
  });

  it("should accept boundary fiscal months (1 and 12)", () => {
    expect(createInvoiceSchema.safeParse({ ...validInvoice, fiscalMonth: 1 }).success).toBe(true);
    expect(createInvoiceSchema.safeParse({ ...validInvoice, fiscalMonth: 12 }).success).toBe(true);
  });

  it("should coerce date strings to Date objects", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      invoiceDate: "2025-06-15",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.invoiceDate).toBeInstanceOf(Date);
    }
  });

  it("should pass when optional fields are omitted", () => {
    const result = createInvoiceSchema.safeParse(validInvoice);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.providerName).toBeUndefined();
      expect(result.data.invoiceNumber).toBeUndefined();
      expect(result.data.invoiceDate).toBeUndefined();
      expect(result.data.description).toBeUndefined();
    }
  });

  it("should reject when required fields are missing", () => {
    expect(createInvoiceSchema.safeParse({}).success).toBe(false);
    expect(createInvoiceSchema.safeParse({ deductionCategory: "DONACIONES" }).success).toBe(false);
  });

  it("should validate providerCuit using the cuit schema", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      providerCuit: "20273958601",
    });
    expect(result.success).toBe(false);
  });

  describe("ALQUILER_VIVIENDA contract dates", () => {
    const alquilerBase = {
      ...validInvoice,
      deductionCategory: "ALQUILER_VIVIENDA" as const,
    };

    it("requires contractStartDate for ALQUILER_VIVIENDA", () => {
      const result = createInvoiceSchema.safeParse({
        ...alquilerBase,
        contractEndDate: "2025-12-31",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join("."));
        expect(paths).toContain("contractStartDate");
      }
    });

    it("requires contractEndDate for ALQUILER_VIVIENDA", () => {
      const result = createInvoiceSchema.safeParse({
        ...alquilerBase,
        contractStartDate: "2025-01-01",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join("."));
        expect(paths).toContain("contractEndDate");
      }
    });

    it("rejects ALQUILER_VIVIENDA with no contract dates", () => {
      const result = createInvoiceSchema.safeParse(alquilerBase);
      expect(result.success).toBe(false);
    });

    it("accepts ALQUILER_VIVIENDA with both contract dates", () => {
      const result = createInvoiceSchema.safeParse({
        ...alquilerBase,
        contractStartDate: "2025-01-01",
        contractEndDate: "2025-12-31",
      });
      expect(result.success).toBe(true);
    });

    it("does not require contract dates for other categories", () => {
      const result = createInvoiceSchema.safeParse({
        ...validInvoice,
        deductionCategory: "GASTOS_MEDICOS",
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("updateInvoiceSchema", () => {
  it("should accept an empty object (all fields optional)", () => {
    const result = updateInvoiceSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should accept a partial update with only amount", () => {
    const result = updateInvoiceSchema.safeParse({ amount: 20000 });
    expect(result.success).toBe(true);
  });

  it("should accept a partial update with only deductionCategory", () => {
    const result = updateInvoiceSchema.safeParse({
      deductionCategory: "DONACIONES",
    });
    expect(result.success).toBe(true);
  });

  it("should still validate field constraints on partial updates", () => {
    expect(updateInvoiceSchema.safeParse({ amount: -100 }).success).toBe(false);

    expect(updateInvoiceSchema.safeParse({ fiscalYear: 1999 }).success).toBe(false);

    expect(updateInvoiceSchema.safeParse({ deductionCategory: "INVALID" }).success).toBe(false);
  });

  it("should accept a full valid invoice as an update", () => {
    const result = updateInvoiceSchema.safeParse(validInvoice);
    expect(result.success).toBe(true);
  });
});

describe("getInvoiceNumberFormat", () => {
  const STANDARD_TYPES: InvoiceType[] = [
    "FACTURA_B",
    "FACTURA_C",
    "NOTA_DEBITO_B",
    "NOTA_DEBITO_C",
    "NOTA_CREDITO_B",
    "NOTA_CREDITO_C",
    "RECIBO_B",
    "RECIBO_C",
    "NOTA_VENTA_B",
    "NOTA_VENTA_C",
    "OTRO_COMPROBANTE_B",
    "OTRO_COMPROBANTE_C",
    "TIQUE_FACTURA_B",
  ];
  const FREE_FORM_TYPES: InvoiceType[] = ["DOCUMENTO_ADUANERO", "OTROS_EXCEPTUADOS"];

  it("returns a shape with regex, description, and example for every invoice type", () => {
    for (const type of INVOICE_TYPES) {
      const format = getInvoiceNumberFormat(type);
      expect(format.regex).toBeInstanceOf(RegExp);
      expect(typeof format.description).toBe("string");
      expect(format.description.length).toBeGreaterThan(0);
      expect(typeof format.example).toBe("string");
      expect(format.example.length).toBeGreaterThan(0);
    }
  });

  it("every standard type uses the XXXXX-XXXXXXXX regex and a matching example", () => {
    for (const type of STANDARD_TYPES) {
      const format = getInvoiceNumberFormat(type);
      expect(format.regex.source).toBe("^\\d{5}-\\d{8}$");
      expect(format.regex.test(format.example)).toBe(true);
    }
  });

  it("standard types accept valid punto-de-venta + número format", () => {
    for (const type of STANDARD_TYPES) {
      expect(invoiceNumberMatchesType("00001-00012345", type)).toBe(true);
      expect(invoiceNumberMatchesType("99999-99999999", type)).toBe(true);
    }
  });

  it("standard types reject malformed numbers", () => {
    for (const type of STANDARD_TYPES) {
      expect(invoiceNumberMatchesType("1-12345", type)).toBe(false);
      expect(invoiceNumberMatchesType("abc", type)).toBe(false);
      expect(invoiceNumberMatchesType("", type)).toBe(false);
      expect(invoiceNumberMatchesType("00001-1234567", type)).toBe(false);
      expect(invoiceNumberMatchesType("00001-123456789", type)).toBe(false);
      expect(invoiceNumberMatchesType("00001 00012345", type)).toBe(false);
    }
  });

  it("free-form types accept any non-empty identifier", () => {
    for (const type of FREE_FORM_TYPES) {
      expect(invoiceNumberMatchesType("ABC-123/XYZ", type)).toBe(true);
      expect(invoiceNumberMatchesType("19001MANI000001A", type)).toBe(true);
      expect(invoiceNumberMatchesType("123", type)).toBe(true);
    }
  });

  it("free-form types reject empty / whitespace-only identifiers", () => {
    for (const type of FREE_FORM_TYPES) {
      expect(invoiceNumberMatchesType("", type)).toBe(false);
      expect(invoiceNumberMatchesType(" ", type)).toBe(false);
    }
  });
});

describe("createInvoiceSchema invoice number format", () => {
  it("accepts a valid standard invoice number matching the type", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      invoiceType: "FACTURA_B",
      invoiceNumber: "00001-00000123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed standard invoice number with an error on invoiceNumber", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      invoiceType: "FACTURA_B",
      invoiceNumber: "1-123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("invoiceNumber");
      const message = result.error.issues.find(
        (i) => i.path.join(".") === "invoiceNumber",
      )?.message;
      expect(message).toMatch(/Formato inválido/);
      expect(message).toMatch(/00001-00012345/);
    }
  });

  it("still accepts omitting invoiceNumber entirely", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      invoiceType: "FACTURA_B",
    });
    expect(result.success).toBe(true);
  });

  it("accepts any non-empty identifier for DOCUMENTO_ADUANERO", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      invoiceType: "DOCUMENTO_ADUANERO",
      invoiceNumber: "19001MANI000001A",
    });
    expect(result.success).toBe(true);
  });

  it("accepts any non-empty identifier for OTROS_EXCEPTUADOS", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      invoiceType: "OTROS_EXCEPTUADOS",
      invoiceNumber: "REF-2025/042",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a value that would be valid for a different type", () => {
    // Standard format is rejected by free-form? No — free-form accepts any non-empty.
    // Here we test the reverse: a free-form identifier used with a standard type.
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      invoiceType: "FACTURA_B",
      invoiceNumber: "19001MANI000001A",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateInvoiceSchema invoice number format", () => {
  it("validates invoiceNumber against invoiceType when both are present", () => {
    const result = updateInvoiceSchema.safeParse({
      invoiceType: "FACTURA_B",
      invoiceNumber: "1-123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("invoiceNumber");
    }
  });

  it("accepts a standalone invoiceNumber update without invoiceType", () => {
    // Partial updates can't cross-validate without both fields — permissive.
    const result = updateInvoiceSchema.safeParse({
      invoiceNumber: "anything-goes",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a standalone invoiceType update", () => {
    const result = updateInvoiceSchema.safeParse({
      invoiceType: "FACTURA_C",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a matching pair", () => {
    const result = updateInvoiceSchema.safeParse({
      invoiceType: "FACTURA_B",
      invoiceNumber: "00001-00000123",
    });
    expect(result.success).toBe(true);
  });
});

describe("ALL_DEDUCTION_CATEGORIES", () => {
  it("includes all user-selectable categories plus NO_DEDUCIBLE", () => {
    for (const cat of DEDUCTION_CATEGORIES) {
      expect(ALL_DEDUCTION_CATEGORIES).toContain(cat);
    }
    expect(ALL_DEDUCTION_CATEGORIES).toContain("NO_DEDUCIBLE");
  });

  it("has exactly one more entry than DEDUCTION_CATEGORIES", () => {
    expect(ALL_DEDUCTION_CATEGORIES.length).toBe(DEDUCTION_CATEGORIES.length + 1);
  });

  it("DEDUCTION_CATEGORIES does not include NO_DEDUCIBLE", () => {
    expect((DEDUCTION_CATEGORIES as readonly string[]).includes("NO_DEDUCIBLE")).toBe(false);
  });
});
