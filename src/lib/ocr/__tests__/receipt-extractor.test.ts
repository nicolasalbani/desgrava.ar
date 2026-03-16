import { describe, it, expect } from "vitest";
import { extractReceiptFields } from "../receipt-extractor";
import { existsSync, readFileSync } from "fs";
import path from "path";

// Representative text extracted from an ARCA "Recibo de Sueldo" PDF
const RECIBO_SUELDO_TEXT = `
RECIBO DE SUELDO
LIQUIDACIÓN CORRESPONDIENTE AL PERÍODO: Febrero 2026
Datos del Empleador
Apellido y Nombre: SETTI LUCIANA CUIL/CUIT: 23-29737726-4
Domicilio Laboral: CHILE 849, PILAR, BUENOS AIRES, CP:1629 ART Contratada: 00051 - PROVINCIA
Inicio: 09/2021
Datos del Trabajador Fecha de Ingreso: 20/09/2021
Apellido y Nombre: ZULLY SOFIA PAREDES FRETES
CUIT/CUIL: 27-94689765-0
Obra Social: AUXILIAR CASAS PARTICULARES
Detalle del Período Desde: 01/02/2026 Hasta: 28/02/2026
Categoría Profesional: Personal para tareas generales Condición: Activo
Modalidad de Prestación: Con retiro para distintos empleadores Horas semanales: Menos de 12 horas
Modalidad de Liquidación: Mensual Total Horas trabajadas: 54 hs
N° de Comprobante de pago de Aportes y Contribuciones
Detalle de la Remuneración
Básico $ 343.116,00
Antigüedad $ 13.724,00
Viáticos $ 40.000,00
Presentismo $ 34.311,00
Otros $ 20.000,00
Total $ 451.151,00
Observaciones
Original para el Empleador
`.trim();

// ── Inline text extraction tests ────────────────────────────

describe("extractReceiptFields — inline text", () => {
  it("extracts worker name", () => {
    const fields = extractReceiptFields(RECIBO_SUELDO_TEXT);
    expect(fields.workerName).toBe("ZULLY SOFIA PAREDES FRETES");
  });

  it("extracts worker CUIL", () => {
    const fields = extractReceiptFields(RECIBO_SUELDO_TEXT);
    expect(fields.workerCuil).toBe("27946897650");
  });

  it("extracts employer name", () => {
    const fields = extractReceiptFields(RECIBO_SUELDO_TEXT);
    expect(fields.employerName).toBe("SETTI LUCIANA");
  });

  it("extracts employer CUIT", () => {
    const fields = extractReceiptFields(RECIBO_SUELDO_TEXT);
    expect(fields.employerCuit).toBe("23297377264");
  });

  it("extracts periodo", () => {
    const fields = extractReceiptFields(RECIBO_SUELDO_TEXT);
    expect(fields.periodo).toBe("Febrero 2026");
  });

  it("extracts fiscal year", () => {
    const fields = extractReceiptFields(RECIBO_SUELDO_TEXT);
    expect(fields.fiscalYear).toBe(2026);
  });

  it("extracts fiscal month", () => {
    const fields = extractReceiptFields(RECIBO_SUELDO_TEXT);
    expect(fields.fiscalMonth).toBe(2);
  });

  it("extracts categoría profesional", () => {
    const fields = extractReceiptFields(RECIBO_SUELDO_TEXT);
    expect(fields.categoriaProfesional).toBe("Personal para tareas generales");
  });

  it("extracts modalidad de prestación", () => {
    const fields = extractReceiptFields(RECIBO_SUELDO_TEXT);
    expect(fields.modalidadPrestacion).toBe("Con retiro para distintos empleadores");
  });

  it("extracts horas semanales", () => {
    const fields = extractReceiptFields(RECIBO_SUELDO_TEXT);
    expect(fields.horasSemanales).toBe("Menos de 12 horas");
  });

  it("extracts modalidad de liquidación", () => {
    const fields = extractReceiptFields(RECIBO_SUELDO_TEXT);
    expect(fields.modalidadLiquidacion).toBe("Mensual");
  });

  it("extracts total horas trabajadas", () => {
    const fields = extractReceiptFields(RECIBO_SUELDO_TEXT);
    expect(fields.totalHorasTrabajadas).toBe("54 hs");
  });

  it("extracts básico amount", () => {
    const fields = extractReceiptFields(RECIBO_SUELDO_TEXT);
    expect(fields.basico).toBe(343116);
  });

  it("extracts antigüedad amount", () => {
    const fields = extractReceiptFields(RECIBO_SUELDO_TEXT);
    expect(fields.antiguedad).toBe(13724);
  });

  it("extracts viáticos amount", () => {
    const fields = extractReceiptFields(RECIBO_SUELDO_TEXT);
    expect(fields.viaticos).toBe(40000);
  });

  it("extracts presentismo amount", () => {
    const fields = extractReceiptFields(RECIBO_SUELDO_TEXT);
    expect(fields.presentismo).toBe(34311);
  });

  it("extracts otros amount", () => {
    const fields = extractReceiptFields(RECIBO_SUELDO_TEXT);
    expect(fields.otros).toBe(20000);
  });

  it("extracts total amount", () => {
    const fields = extractReceiptFields(RECIBO_SUELDO_TEXT);
    expect(fields.total).toBe(451151);
  });

  it("has high confidence when all key fields are found", () => {
    const fields = extractReceiptFields(RECIBO_SUELDO_TEXT);
    expect(fields.confidence).toBe(1);
  });
});

// ── Edge cases ──────────────────────────────────────────────

describe("extractReceiptFields — edge cases", () => {
  it("returns null fields for empty text", () => {
    const fields = extractReceiptFields("");
    expect(fields.workerName).toBeNull();
    expect(fields.workerCuil).toBeNull();
    expect(fields.total).toBeNull();
    expect(fields.periodo).toBeNull();
    expect(fields.confidence).toBe(0);
  });

  it("handles text with only a total", () => {
    const fields = extractReceiptFields("Total $ 100.000,00");
    expect(fields.total).toBe(100000);
    expect(fields.confidence).toBeGreaterThan(0);
  });

  it("handles different month names", () => {
    const text = "LIQUIDACIÓN CORRESPONDIENTE AL PERÍODO: Diciembre 2025";
    const fields = extractReceiptFields(text);
    expect(fields.periodo).toBe("Diciembre 2025");
    expect(fields.fiscalYear).toBe(2025);
    expect(fields.fiscalMonth).toBe(12);
  });

  it("handles septiembre/setiembre variant", () => {
    const text = "LIQUIDACIÓN CORRESPONDIENTE AL PERÍODO: Setiembre 2025";
    const fields = extractReceiptFields(text);
    expect(fields.fiscalMonth).toBe(9);
  });

  it("computes total from components when Total line is missing", () => {
    const text = `
      Básico $ 100.000,00
      Antigüedad $ 10.000,00
      Presentismo $ 5.000,00
    `;
    const fields = extractReceiptFields(text);
    expect(fields.total).toBe(115000);
  });

  it("extracts amounts with Argentine number format", () => {
    const text = "Básico $ 1.234.567,89";
    const fields = extractReceiptFields(text);
    expect(fields.basico).toBeCloseTo(1234567.89, 2);
  });
});

// ── Real PDF fixture test ───────────────────────────────────

function fixture(name: string) {
  const p = path.join(__dirname, "fixtures", name);
  return { path: p, exists: existsSync(p) };
}

const reciboFixture = fixture("arca-recibo-pago.pdf");

describe.skipIf(!reciboFixture.exists)(
  "extractReceiptFields — real PDF (arca-recibo-pago.pdf)",
  () => {
    it("extracts fields from the real PDF via pipeline", async () => {
      const { processDocument } = await import("../pipeline");
      const buffer = readFileSync(reciboFixture.path);
      const result = await processDocument(buffer, "application/pdf");

      // Use the receipt extractor on the extracted text
      const fields = extractReceiptFields(result.text);

      expect(fields.workerCuil).toBe("27946897650");
      expect(fields.employerCuit).toBe("23297377264");
      expect(fields.fiscalMonth).toBe(2);
      expect(fields.fiscalYear).toBe(2026);
      expect(fields.total).toBe(451151);
      expect(fields.confidence).toBeGreaterThanOrEqual(0.6);
    }, 30_000);
  },
);
