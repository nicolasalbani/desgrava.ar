import { describe, it, expect } from "vitest";
import { extractFields } from "../field-extractor";

// Representative text that pdfjs-dist extracts from a standard ARCA-generated invoice PDF.
// The C type letter and "FACTURA" title end up on separate lines because they have
// different Y coordinates in the PDF (different font sizes / positions in the template).
const ARCA_FACTURA_C_TEXT = `
ORIGINAL DA SILVA BAREIRO VIVIANA ELIZABETH C FACTURA
COD. 011
Punto de Venta: 00002 Comp. Nro: 00000670
Fecha de Emisión: 04/03/2026
CUIT: 23295029544
Ingresos Brutos: EXENTA
Fecha de Inicio de Actividades: 01/07/2017
Razón Social: DA SILVA BAREIRO VIVIANA ELIZABETH
Domicilio Comercial: Alem Leandro N. Av. 719 Piso:16 Dpto:1 - Ciudad de Buenos Aires
Condición frente al IVA: Responsable Monotributo
Período Facturado Desde: 04/03/2026 Hasta: 04/03/2026 Fecha de Vto. para el pago: 04/03/2026
CUIT: 20314468849
Apellido y Nombre / Razón Social: ALBANI DARIO NICOLAS
Condición frente al IVA: Consumidor Final
Domicilio: Mitre Emilio 1050 Piso:10 Dpto:B - Capital Federal, Ciudad de Buenos Aires
Condición de venta: Otros medios de pago electrónico
Código Producto / Servicio Cantidad U. Medida Precio Unit. % Bonif Imp. Bonif. Subtotal
1 Honorarios profesionales sesión de psicología por 1,00 otras unidades 40000,00 0,00 0,00 40000,00
Subtotal: $ 0,00
Importe Otros Tributos: $ 0,00
Importe Total: $ 40000,00
CAE N°: 86096169975744
Fecha de Vto. de CAE: 14/03/2026
`.trim();

// Same invoice but with the C and FACTURA on separate lines (worst-case split layout)
const ARCA_FACTURA_C_SPLIT_TEXT = `
ORIGINAL DA SILVA BAREIRO VIVIANA ELIZABETH FACTURA
C COD. 011
Punto de Venta: 00002 Comp. Nro: 00000670
Fecha de Emisión: 04/03/2026
CUIT: 23295029544
Razón Social: DA SILVA BAREIRO VIVIANA ELIZABETH
CUIT: 20314468849
Importe Total: $ 40000,00
`.trim();

describe("extractFields — ARCA Factura C (psychology session)", () => {
  it("detects invoice type as FACTURA_C via reversed layout pattern", () => {
    const fields = extractFields(ARCA_FACTURA_C_TEXT);
    expect(fields.invoiceType).toBe("FACTURA_C");
  });

  it("detects invoice type as FACTURA_C via COD.011 fallback when layout is split", () => {
    const fields = extractFields(ARCA_FACTURA_C_SPLIT_TEXT);
    expect(fields.invoiceType).toBe("FACTURA_C");
  });

  it("extracts provider CUIT (first CUIT in document)", () => {
    const fields = extractFields(ARCA_FACTURA_C_TEXT);
    expect(fields.cuit).toBe("23295029544");
  });

  it("extracts invoice number in XXXXX-YYYYYYYY format", () => {
    const fields = extractFields(ARCA_FACTURA_C_TEXT);
    expect(fields.invoiceNumber).toBe("00002-00000670");
  });

  it("extracts total amount as number", () => {
    const fields = extractFields(ARCA_FACTURA_C_TEXT);
    expect(fields.amount).toBe(40000);
  });

  it("extracts date in YYYY-MM-DD format", () => {
    const fields = extractFields(ARCA_FACTURA_C_TEXT);
    expect(fields.date).toBe("2026-03-04");
  });

  it("extracts provider name from Razón Social label", () => {
    const fields = extractFields(ARCA_FACTURA_C_TEXT);
    expect(fields.providerName).toBe("DA SILVA BAREIRO VIVIANA ELIZABETH");
  });

  it("returns high confidence when all fields are found", () => {
    const fields = extractFields(ARCA_FACTURA_C_TEXT);
    expect(fields.confidence).toBe(1);
  });
});

describe("extractFields — invoice type patterns", () => {
  it("detects Factura A as FACTURA_B via reversed layout (A→B mapping)", () => {
    expect(extractFields("A FACTURA\nCOD. 001\nCUIT: 20123456789").invoiceType).toBe("FACTURA_B");
  });

  it("detects FACTURA_B via reversed layout", () => {
    expect(extractFields("B FACTURA\nCOD. 006\nCUIT: 20123456789").invoiceType).toBe("FACTURA_B");
  });

  it("detects FACTURA_C via standard layout (letter after FACTURA)", () => {
    expect(extractFields("FACTURA C\nCUIT: 20123456789\nImporte Total: $1000").invoiceType).toBe(
      "FACTURA_C",
    );
  });

  it("detects FACTURA_C via COD.011 when no adjacent letter pattern exists", () => {
    // Simulates worst case: FACTURA and C are far apart in the extracted text
    const text = "Emisor SA\nFACTURA\nPunto de Venta: 00001\nC\nCOD. 011\nCUIT: 20123456789";
    expect(extractFields(text).invoiceType).toBe("FACTURA_C");
  });

  it("detects NOTA_CREDITO_C", () => {
    expect(extractFields("NOTA DE CRÉDITO C\nCUIT: 20123456789").invoiceType).toBe(
      "NOTA_CREDITO_C",
    );
  });

  it("detects Nota Débito A as NOTA_DEBITO_B (A→B mapping)", () => {
    expect(extractFields("NOTA DE DÉBITO A\nCUIT: 20123456789").invoiceType).toBe("NOTA_DEBITO_B");
  });

  it("detects RECIBO as RECIBO_B", () => {
    expect(extractFields("RECIBO\nCUIT: 20123456789").invoiceType).toBe("RECIBO_B");
  });

  it("detects TICKET as TIQUE_FACTURA_B", () => {
    expect(extractFields("TICKET\nCUIT: 20123456789").invoiceType).toBe("TIQUE_FACTURA_B");
  });

  it("detects TIQUE-FACTURA B", () => {
    expect(extractFields("TIQUE-FACTURA B\nCUIT: 20123456789").invoiceType).toBe("TIQUE_FACTURA_B");
  });

  it("returns null when no invoice type found", () => {
    expect(extractFields("Texto sin tipo de comprobante").invoiceType).toBeNull();
  });

  it("does not false-positive FACTURA_C on 'FACTURA COD. 011' (C from COD)", () => {
    // The \b word boundary after C should prevent matching "COD" as type "C"
    // But COD. 011 fallback will still correctly identify it as FACTURA_C
    const fields = extractFields("FACTURA\nCOD. 011\nCUIT: 20123456789\nImporte Total: $500");
    expect(fields.invoiceType).toBe("FACTURA_C");
  });
});

describe("extractFields — amount parsing", () => {
  it("parses Argentine dot-thousand comma-decimal format (40.000,00)", () => {
    const fields = extractFields("Importe Total: $ 40.000,00");
    expect(fields.amount).toBe(40000);
  });

  it("parses plain integer amount", () => {
    const fields = extractFields("Importe Total: $ 40000,00");
    expect(fields.amount).toBe(40000);
  });
});
