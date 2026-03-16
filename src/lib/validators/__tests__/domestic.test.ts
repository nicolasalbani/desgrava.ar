import { describe, it, expect } from "vitest";
import {
  createDomesticWorkerSchema,
  updateDomesticWorkerSchema,
  createDomesticReceiptSchema,
  updateDomesticReceiptSchema,
  paymentDetailSchema,
  monthName,
  periodoLabel,
  MESES,
} from "@/lib/validators/domestic";

const VALID_CUIL = "27-94689765-0";

const validWorker = {
  cuil: VALID_CUIL,
  apellidoNombre: "PAREDES FRETES ZULLY SOFIA",
  tipoTrabajo: "Personal para tareas generales",
  fiscalYear: 2025,
};

const validReceipt = {
  fiscalYear: 2026,
  fiscalMonth: 2,
  periodo: "Febrero 2026",
  total: 451151.0,
};

// ── Worker schema tests ─────────────────────────────────────

describe("createDomesticWorkerSchema", () => {
  it("should accept a valid worker with required fields", () => {
    const result = createDomesticWorkerSchema.safeParse(validWorker);
    expect(result.success).toBe(true);
  });

  it("should accept a worker with all optional fields", () => {
    const result = createDomesticWorkerSchema.safeParse({
      ...validWorker,
      domicilioLaboral: "Chile 849 PILAR BUENOS AIRES",
      horasSemanales: "Menos de 12 horas",
      condicion: "Activo",
      obraSocial: "AUXILIAR CASAS PARTICULARES",
      fechaNacimiento: "08/04/1985",
      fechaIngreso: "20/09/2021",
      modalidadPago: "Diaria",
      modalidadTrabajo: "Con retiro para distintos empleadores",
      remuneracionPactada: 1600,
    });
    expect(result.success).toBe(true);
  });

  it("should strip dashes from CUIL and validate checksum", () => {
    const result = createDomesticWorkerSchema.safeParse(validWorker);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cuil).toBe("27946897650");
    }
  });

  it("should reject an invalid CUIL", () => {
    const result = createDomesticWorkerSchema.safeParse({
      ...validWorker,
      cuil: "11-11111111-1",
    });
    expect(result.success).toBe(false);
  });

  it("should reject a CUIL with wrong length", () => {
    const result = createDomesticWorkerSchema.safeParse({
      ...validWorker,
      cuil: "12345",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty apellidoNombre", () => {
    const result = createDomesticWorkerSchema.safeParse({
      ...validWorker,
      apellidoNombre: "",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty tipoTrabajo", () => {
    const result = createDomesticWorkerSchema.safeParse({
      ...validWorker,
      tipoTrabajo: "",
    });
    expect(result.success).toBe(false);
  });

  it("should reject fiscalYear below 2020", () => {
    const result = createDomesticWorkerSchema.safeParse({
      ...validWorker,
      fiscalYear: 2019,
    });
    expect(result.success).toBe(false);
  });

  it("should reject fiscalYear above 2030", () => {
    const result = createDomesticWorkerSchema.safeParse({
      ...validWorker,
      fiscalYear: 2031,
    });
    expect(result.success).toBe(false);
  });

  it("should coerce string numbers for remuneracionPactada", () => {
    const result = createDomesticWorkerSchema.safeParse({
      ...validWorker,
      remuneracionPactada: "1600.00",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.remuneracionPactada).toBe(1600);
    }
  });

  it("should default condicion to Activo", () => {
    const result = createDomesticWorkerSchema.safeParse(validWorker);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.condicion).toBe("Activo");
    }
  });
});

describe("updateDomesticWorkerSchema", () => {
  it("should accept partial updates", () => {
    const result = updateDomesticWorkerSchema.safeParse({
      apellidoNombre: "NUEVO NOMBRE",
    });
    expect(result.success).toBe(true);
  });

  it("should accept empty object", () => {
    const result = updateDomesticWorkerSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ── Receipt schema tests ────────────────────────────────────

describe("createDomesticReceiptSchema", () => {
  it("should accept a valid receipt with required fields", () => {
    const result = createDomesticReceiptSchema.safeParse(validReceipt);
    expect(result.success).toBe(true);
  });

  it("should accept a receipt with all optional fields", () => {
    const result = createDomesticReceiptSchema.safeParse({
      ...validReceipt,
      domesticWorkerId: "some-id",
      categoriaProfesional: "Personal para tareas generales",
      modalidadPrestacion: "Con retiro para distintos empleadores",
      horasSemanales: "Menos de 12 horas",
      modalidadLiquidacion: "Mensual",
      totalHorasTrabajadas: "54 hs",
      basico: 343116,
      antiguedad: 13724,
      viaticos: 40000,
      presentismo: 34311,
      otros: 20000,
      contributionAmount: 2408.94,
      contributionDate: "02/03/2026",
      paymentDetails: [
        { tipoPago: "APORTES", importe: 1784.27, fechaPago: "02/03/2026" },
        { tipoPago: "LRT", importe: 6332.84, fechaPago: "02/03/2026" },
        { tipoPago: "CONTRIBUCIONES", importe: 624.67, fechaPago: "02/03/2026" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("should reject zero total", () => {
    const result = createDomesticReceiptSchema.safeParse({
      ...validReceipt,
      total: 0,
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative total", () => {
    const result = createDomesticReceiptSchema.safeParse({
      ...validReceipt,
      total: -100,
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty periodo", () => {
    const result = createDomesticReceiptSchema.safeParse({
      ...validReceipt,
      periodo: "",
    });
    expect(result.success).toBe(false);
  });

  it("should reject fiscalMonth below 1", () => {
    const result = createDomesticReceiptSchema.safeParse({
      ...validReceipt,
      fiscalMonth: 0,
    });
    expect(result.success).toBe(false);
  });

  it("should reject fiscalMonth above 12", () => {
    const result = createDomesticReceiptSchema.safeParse({
      ...validReceipt,
      fiscalMonth: 13,
    });
    expect(result.success).toBe(false);
  });

  it("should coerce string amounts", () => {
    const result = createDomesticReceiptSchema.safeParse({
      ...validReceipt,
      total: "451151.00",
      basico: "343116",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total).toBe(451151);
      expect(result.data.basico).toBe(343116);
    }
  });
});

describe("updateDomesticReceiptSchema", () => {
  it("should accept partial updates", () => {
    const result = updateDomesticReceiptSchema.safeParse({
      total: 500000,
    });
    expect(result.success).toBe(true);
  });
});

// ── Payment detail schema tests ─────────────────────────────

describe("paymentDetailSchema", () => {
  it("should accept valid APORTES payment", () => {
    const result = paymentDetailSchema.safeParse({
      tipoPago: "APORTES",
      importe: 1784.27,
      fechaPago: "02/03/2026",
    });
    expect(result.success).toBe(true);
  });

  it("should accept valid LRT payment", () => {
    const result = paymentDetailSchema.safeParse({
      tipoPago: "LRT",
      importe: 6332.84,
    });
    expect(result.success).toBe(true);
  });

  it("should accept valid CONTRIBUCIONES payment", () => {
    const result = paymentDetailSchema.safeParse({
      tipoPago: "CONTRIBUCIONES",
      importe: 624.67,
      fechaPago: "02/03/2026",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid tipoPago", () => {
    const result = paymentDetailSchema.safeParse({
      tipoPago: "INVALID",
      importe: 100,
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative importe", () => {
    const result = paymentDetailSchema.safeParse({
      tipoPago: "APORTES",
      importe: -100,
    });
    expect(result.success).toBe(false);
  });
});

// ── Helper function tests ───────────────────────────────────

describe("monthName", () => {
  it("should return correct month name for valid month", () => {
    expect(monthName(1)).toBe("Enero");
    expect(monthName(6)).toBe("Junio");
    expect(monthName(12)).toBe("Diciembre");
  });

  it("should return fallback for invalid month", () => {
    expect(monthName(0)).toBe("Mes 0");
    expect(monthName(13)).toBe("Mes 13");
  });
});

describe("periodoLabel", () => {
  it("should format month and year", () => {
    expect(periodoLabel(2, 2026)).toBe("Febrero 2026");
    expect(periodoLabel(12, 2025)).toBe("Diciembre 2025");
  });
});

describe("MESES", () => {
  it("should have 12 months", () => {
    expect(MESES).toHaveLength(12);
  });

  it("should start with Enero and end with Diciembre", () => {
    expect(MESES[0]).toBe("Enero");
    expect(MESES[11]).toBe("Diciembre");
  });
});
