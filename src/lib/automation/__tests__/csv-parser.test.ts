import { describe, it, expect } from "vitest";
import {
  parseComprobantesCSV,
  mapComprobantesToInvoices,
  invoiceDedupeKey,
  parseArgentineNumber,
  parseArgentineDate,
} from "../csv-parser";

// ── Sample CSV data (real ARCA format) ──────────────────────

// Real ARCA server-side CSV: semicolons, quoted headers, YYYY-MM-DD dates, raw tipo codes
const SAMPLE_CSV_ARCA = `"Fecha de Emisión";"Tipo de Comprobante";"Punto de Venta";"Número Desde";"Número Hasta";"Cód. Autorización";"Tipo Doc. Emisor";"Nro. Doc. Emisor";"Denominación Emisor";"Tipo Doc. Receptor";"Nro. Doc. Receptor";"Tipo Cambio";"Moneda";"Imp. Neto Gravado IVA 0%";"IVA 2,5%";"Imp. Neto Gravado IVA 2,5%";"IVA 5%";"Imp. Neto Gravado IVA 5%";"IVA 10,5%";"Imp. Neto Gravado IVA 10,5%";"IVA 21%";"Imp. Neto Gravado IVA 21%";"IVA 27%";"Imp. Neto Gravado IVA 27%";"Imp. Neto Gravado Total";"Imp. Neto No Gravado";"Imp. Op. Exentas";"Otros Tributos";"Total IVA";"Imp. Total"
2025-01-01;11;6;125146;125146;74526512408310;80;30534357016;FUNDACION ESCUELAS SAN JUAN;80;20314468849;1,00;$;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;306800,00
2025-06-12;6;1208;66512;66512;75023494857595;80;30612865333;MAYCAR SOCIEDAD ANONIMA;96;31446884;1,00;$;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;74,07;0,00;366748,10
2025-12-16;1;18;81188;81188;75034127293506;80;30715686054;MELI LOG SRL;80;20314468849;1,00;$;;;;;;;;989,43;4711,56;;;4711,56;0,00;0,00;282,69;989,43;5983,68`;

// Legacy format with comma separator and text-based tipos (for backward compat)
const SAMPLE_CSV_LEGACY = `Fecha,Tipo,Punto de Venta,Número Desde,Número Hasta,Cód. Autorización,Tipo Doc. Emisor,Nro. Doc. Emisor,Denominación Emisor,Tipo Cambio,Moneda,Imp. Neto Gravado,Imp. Neto No Gravado,Imp. Op. Exentas,IVA,Imp. Total
15/03/2025,1 - Factura A,00005,00001234,00001234,12345678901234,80,20123456789,EMPRESA TEST SA,1,PES,"1.000,00","0,00","0,00","210,00","1.210,00"
20/06/2025,6 - Factura B,00012,00005678,00005678,98765432109876,80,27987654321,PROVEEDOR SALUD SRL,1,PES,"5.000,00","0,00","0,00","1.050,00","6.050,00"`;

// ── parseComprobantesCSV ─────────────────────────────────────

describe("parseComprobantesCSV", () => {
  it("parses real ARCA CSV format (semicolons, ISO dates, raw tipo codes)", () => {
    const results = parseComprobantesCSV(SAMPLE_CSV_ARCA);
    expect(results).toHaveLength(3);
  });

  it("extracts correct fields from ARCA CSV first row", () => {
    const results = parseComprobantesCSV(SAMPLE_CSV_ARCA);
    const first = results[0];
    expect(first.fecha).toBe("2025-01-01");
    expect(first.tipo).toBe("11");
    expect(first.puntoDeVenta).toBe("6");
    expect(first.numeroDesde).toBe("125146");
    expect(first.cuitEmisor).toBe("30534357016");
    expect(first.denominacionEmisor).toBe("FUNDACION ESCUELAS SAN JUAN");
    expect(first.importeTotal).toBe(306800);
    expect(first.moneda).toBe("$");
  });

  it("extracts correct amount from second row (Argentine format)", () => {
    const results = parseComprobantesCSV(SAMPLE_CSV_ARCA);
    expect(results[1].importeTotal).toBe(366748.1);
  });

  it("handles rows with empty IVA fields (semicolons only)", () => {
    const results = parseComprobantesCSV(SAMPLE_CSV_ARCA);
    // Third row has ;;;; for empty IVA fields
    expect(results[2].importeTotal).toBe(5983.68);
    expect(results[2].cuitEmisor).toBe("30715686054");
  });

  it("parses legacy comma-separated CSV with text tipos", () => {
    const results = parseComprobantesCSV(SAMPLE_CSV_LEGACY);
    expect(results).toHaveLength(2);
    expect(results[0].importeTotal).toBe(1210);
  });

  it("returns empty array for empty content", () => {
    expect(parseComprobantesCSV("")).toEqual([]);
    expect(parseComprobantesCSV("Header only")).toEqual([]);
  });

  it("skips rows with zero amount", () => {
    const csv = `"Fecha de Emisión";"Tipo de Comprobante";"Punto de Venta";"Número Desde";"Nro. Doc. Emisor";"Denominación Emisor";"Moneda";"Imp. Total"
2025-03-15;1;5;1234;20123456789;EMPRESA SA;$;0`;
    const results = parseComprobantesCSV(csv);
    expect(results).toHaveLength(0);
  });

  it("throws for CSV missing required columns", () => {
    const csv = `Fecha,Tipo,Random Column
2025-03-15,1,some value`;
    expect(() => parseComprobantesCSV(csv)).toThrow("columnas requeridas");
  });

  it("handles quoted fields with semicolons inside", () => {
    const csv = `"Fecha de Emisión";"Tipo de Comprobante";"Punto de Venta";"Número Desde";"Nro. Doc. Emisor";"Denominación Emisor";"Moneda";"Imp. Total"
2025-03-15;1;5;1234;20123456789;"EMPRESA; TEST SA";$;1500,00`;
    const results = parseComprobantesCSV(csv);
    expect(results).toHaveLength(1);
    expect(results[0].denominacionEmisor).toBe("EMPRESA; TEST SA");
    expect(results[0].importeTotal).toBe(1500);
  });

  it("handles escaped quotes in quoted fields", () => {
    const csv = `"Fecha de Emisión";"Tipo de Comprobante";"Punto de Venta";"Número Desde";"Nro. Doc. Emisor";"Denominación Emisor";"Moneda";"Imp. Total"
2025-03-15;1;5;1234;20123456789;"EMPRESA ""TEST"" SA";$;1500,00`;
    const results = parseComprobantesCSV(csv);
    expect(results[0].denominacionEmisor).toBe('EMPRESA "TEST" SA');
  });
});

// ── mapComprobantesToInvoices ─────────────────────────────────

describe("mapComprobantesToInvoices", () => {
  it("maps parsed ARCA comprobantes to invoice objects", () => {
    const parsed = parseComprobantesCSV(SAMPLE_CSV_ARCA);
    const invoices = mapComprobantesToInvoices(parsed, 2025);
    expect(invoices).toHaveLength(3);
  });

  it("maps raw numeric tipo codes correctly", () => {
    const parsed = parseComprobantesCSV(SAMPLE_CSV_ARCA);
    const invoices = mapComprobantesToInvoices(parsed, 2025);
    expect(invoices[0].invoiceType).toBe("FACTURA_C"); // tipo 11
    expect(invoices[1].invoiceType).toBe("FACTURA_B"); // tipo 6
    expect(invoices[2].invoiceType).toBe("FACTURA_A"); // tipo 1
  });

  it("maps text-based tipo with code prefix", () => {
    const parsed = parseComprobantesCSV(SAMPLE_CSV_LEGACY);
    const invoices = mapComprobantesToInvoices(parsed, 2025);
    expect(invoices[0].invoiceType).toBe("FACTURA_A"); // "1 - Factura A"
    expect(invoices[1].invoiceType).toBe("FACTURA_B"); // "6 - Factura B"
  });

  it("formats invoice number as XXXXX-YYYYYYYY", () => {
    const parsed = parseComprobantesCSV(SAMPLE_CSV_ARCA);
    const invoices = mapComprobantesToInvoices(parsed, 2025);
    expect(invoices[0].invoiceNumber).toBe("00006-00125146");
    expect(invoices[1].invoiceNumber).toBe("01208-00066512");
    expect(invoices[2].invoiceNumber).toBe("00018-00081188");
  });

  it("preserves raw CUIT digits", () => {
    const parsed = parseComprobantesCSV(SAMPLE_CSV_ARCA);
    const invoices = mapComprobantesToInvoices(parsed, 2025);
    expect(invoices[0].providerCuit).toBe("30534357016");
    expect(invoices[1].providerCuit).toBe("30612865333");
  });

  it("extracts correct fiscal month from ISO date", () => {
    const parsed = parseComprobantesCSV(SAMPLE_CSV_ARCA);
    const invoices = mapComprobantesToInvoices(parsed, 2025);
    expect(invoices[0].fiscalMonth).toBe(1); // January
    expect(invoices[1].fiscalMonth).toBe(6); // June
    expect(invoices[2].fiscalMonth).toBe(12); // December
  });

  it("sets fiscal year from parameter", () => {
    const parsed = parseComprobantesCSV(SAMPLE_CSV_ARCA);
    const invoices = mapComprobantesToInvoices(parsed, 2025);
    expect(invoices.every((inv) => inv.fiscalYear === 2025)).toBe(true);
  });

  it("uses absolute value for amounts", () => {
    const parsed = parseComprobantesCSV(SAMPLE_CSV_ARCA);
    const invoices = mapComprobantesToInvoices(parsed, 2025);
    expect(invoices[0].amount).toBe(306800);
    expect(invoices[2].amount).toBe(5983.68);
  });

  it("skips comprobantes with invalid CUITs", () => {
    const csv = `"Fecha de Emisión";"Tipo de Comprobante";"Punto de Venta";"Número Desde";"Nro. Doc. Emisor";"Denominación Emisor";"Moneda";"Imp. Total"
2025-03-15;1;5;1234;123;SHORT CUIT;$;1000`;
    const parsed = parseComprobantesCSV(csv);
    const invoices = mapComprobantesToInvoices(parsed, 2025);
    expect(invoices).toHaveLength(0);
  });

  it("skips comprobantes with invalid dates", () => {
    const csv = `"Fecha de Emisión";"Tipo de Comprobante";"Punto de Venta";"Número Desde";"Nro. Doc. Emisor";"Denominación Emisor";"Moneda";"Imp. Total"
invalid;1;5;1234;20123456789;EMPRESA SA;$;1000`;
    const parsed = parseComprobantesCSV(csv);
    const invoices = mapComprobantesToInvoices(parsed, 2025);
    expect(invoices).toHaveLength(0);
  });

  it("maps text-based tipo without code prefix", () => {
    const csv = `Fecha,Tipo,Punto de Venta,Número Desde,Nro. Doc. Emisor,Denominación Emisor,Moneda,Imp. Total
15/03/2025,Nota de Crédito B,5,1234,20123456789,EMPRESA SA,PES,500`;
    const parsed = parseComprobantesCSV(csv);
    const invoices = mapComprobantesToInvoices(parsed, 2025);
    expect(invoices[0].invoiceType).toBe("NOTA_CREDITO_B");
  });

  it("defaults unknown tipo to FACTURA_B", () => {
    const csv = `Fecha,Tipo,Punto de Venta,Número Desde,Nro. Doc. Emisor,Denominación Emisor,Moneda,Imp. Total
15/03/2025,999 - Unknown Type,5,1234,20123456789,EMPRESA SA,PES,500`;
    const parsed = parseComprobantesCSV(csv);
    const invoices = mapComprobantesToInvoices(parsed, 2025);
    expect(invoices[0].invoiceType).toBe("FACTURA_B");
  });
});

// ── invoiceDedupeKey ─────────────────────────────────────────

describe("invoiceDedupeKey", () => {
  it("creates consistent dedup key", () => {
    const key = invoiceDedupeKey("20123456789", "00005-00001234", 2025);
    expect(key).toBe("20123456789|00005-00001234|2025");
  });

  it("handles null invoice number", () => {
    const key = invoiceDedupeKey("20123456789", null, 2025);
    expect(key).toBe("20123456789||2025");
  });

  it("produces different keys for different CUITs", () => {
    const key1 = invoiceDedupeKey("20123456789", "00005-00001234", 2025);
    const key2 = invoiceDedupeKey("27987654321", "00005-00001234", 2025);
    expect(key1).not.toBe(key2);
  });

  it("produces different keys for different fiscal years", () => {
    const key1 = invoiceDedupeKey("20123456789", "00005-00001234", 2025);
    const key2 = invoiceDedupeKey("20123456789", "00005-00001234", 2024);
    expect(key1).not.toBe(key2);
  });
});

// ── parseArgentineNumber ─────────────────────────────────────

describe("parseArgentineNumber", () => {
  it("parses Argentine format with dots as thousands and comma as decimal", () => {
    expect(parseArgentineNumber("1.234,56")).toBe(1234.56);
  });

  it("parses simple integers", () => {
    expect(parseArgentineNumber("1000")).toBe(1000);
  });

  it("parses dot-decimal format", () => {
    expect(parseArgentineNumber("1234.56")).toBe(1234.56);
  });

  it("handles dollar sign prefix", () => {
    expect(parseArgentineNumber("$ 1.234,56")).toBe(1234.56);
  });

  it("returns NaN for empty string", () => {
    expect(parseArgentineNumber("")).toBeNaN();
  });

  it("parses large numbers in Argentine format", () => {
    expect(parseArgentineNumber("1.234.567,89")).toBe(1234567.89);
  });

  it("parses numbers with only comma decimal", () => {
    expect(parseArgentineNumber("500,50")).toBe(500.5);
  });

  it("parses ARCA CSV format (no thousands separator, comma decimal)", () => {
    expect(parseArgentineNumber("306800,00")).toBe(306800);
    expect(parseArgentineNumber("366748,10")).toBe(366748.1);
    expect(parseArgentineNumber("5983,68")).toBe(5983.68);
  });
});

// ── parseArgentineDate ───────────────────────────────────────

describe("parseArgentineDate", () => {
  it("parses YYYY-MM-DD (ISO) format from ARCA CSV", () => {
    const date = parseArgentineDate("2025-01-01");
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2025);
    expect(date!.getMonth()).toBe(0); // January (0-indexed)
    expect(date!.getDate()).toBe(1);
  });

  it("parses YYYY-MM-DD with various months", () => {
    const june = parseArgentineDate("2025-06-12");
    expect(june!.getMonth()).toBe(5);
    expect(june!.getDate()).toBe(12);

    const dec = parseArgentineDate("2025-12-16");
    expect(dec!.getMonth()).toBe(11);
    expect(dec!.getDate()).toBe(16);
  });

  it("parses dd/mm/yyyy format", () => {
    const date = parseArgentineDate("15/03/2025");
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2025);
    expect(date!.getMonth()).toBe(2); // March (0-indexed)
    expect(date!.getDate()).toBe(15);
  });

  it("parses dd-mm-yyyy format", () => {
    const date = parseArgentineDate("01-12-2025");
    expect(date).not.toBeNull();
    expect(date!.getMonth()).toBe(11); // December
  });

  it("parses single-digit day and month", () => {
    const date = parseArgentineDate("1/3/2025");
    expect(date).not.toBeNull();
    expect(date!.getDate()).toBe(1);
    expect(date!.getMonth()).toBe(2);
  });

  it("returns null for empty string", () => {
    expect(parseArgentineDate("")).toBeNull();
  });

  it("returns null for invalid format", () => {
    expect(parseArgentineDate("invalid")).toBeNull();
    expect(parseArgentineDate("03/2025")).toBeNull();
  });

  it("returns null for invalid month", () => {
    expect(parseArgentineDate("15/13/2025")).toBeNull();
    expect(parseArgentineDate("15/00/2025")).toBeNull();
    expect(parseArgentineDate("2025-13-01")).toBeNull();
    expect(parseArgentineDate("2025-00-01")).toBeNull();
  });

  it("returns null for invalid day", () => {
    expect(parseArgentineDate("32/03/2025")).toBeNull();
    expect(parseArgentineDate("00/03/2025")).toBeNull();
    expect(parseArgentineDate("2025-03-32")).toBeNull();
    expect(parseArgentineDate("2025-03-00")).toBeNull();
  });
});

// ── Foreign currency (tipo de cambio) ─────────────────────────

describe("foreign currency conversion", () => {
  // CSV with a USD invoice: 7500 USD at exchange rate 1356,5 = 10,173,750 ARS
  const CSV_WITH_USD = `"Fecha de Emisión";"Tipo de Comprobante";"Punto de Venta";"Número Desde";"Número Hasta";"Cód. Autorización";"Tipo Doc. Emisor";"Nro. Doc. Emisor";"Denominación Emisor";"Tipo Doc. Receptor";"Nro. Doc. Receptor";"Tipo Cambio";"Moneda";"Imp. Neto Gravado IVA 0%";"IVA 2,5%";"Imp. Neto Gravado IVA 2,5%";"IVA 5%";"Imp. Neto Gravado IVA 5%";"IVA 10,5%";"Imp. Neto Gravado IVA 10,5%";"IVA 21%";"Imp. Neto Gravado IVA 21%";"IVA 27%";"Imp. Neto Gravado IVA 27%";"Imp. Neto Gravado Total";"Imp. Neto No Gravado";"Imp. Op. Exentas";"Otros Tributos";"Total IVA";"Imp. Total"
2025-08-27;6;5;686;686;12345678901234;80;30717540871;BAREDES S A;80;20314468849;1356,5000;DOL;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;7500,00`;

  it("parses tipoCambio from CSV", () => {
    const parsed = parseComprobantesCSV(CSV_WITH_USD);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].moneda).toBe("DOL");
    expect(parsed[0].tipoCambio).toBeCloseTo(1356.5, 1);
    expect(parsed[0].importeTotal).toBeCloseTo(7500, 2);
  });

  it("converts USD amount to ARS using exchange rate", () => {
    const parsed = parseComprobantesCSV(CSV_WITH_USD);
    const invoices = mapComprobantesToInvoices(parsed, 2025);
    expect(invoices).toHaveLength(1);
    // 7500 * 1356.5 = 10,173,750
    expect(invoices[0].amount).toBeCloseTo(10173750, 0);
  });

  it("does not convert ARS invoices (tipoCambio = 1)", () => {
    const parsed = parseComprobantesCSV(SAMPLE_CSV_ARCA);
    const invoices = mapComprobantesToInvoices(parsed, 2025);
    // First invoice: 306800 ARS with tipoCambio 1
    expect(invoices[0].amount).toBeCloseTo(306800, 2);
  });

  it("defaults tipoCambio to 1 when column is missing", () => {
    const parsed = parseComprobantesCSV(SAMPLE_CSV_LEGACY);
    expect(parsed[0].tipoCambio).toBe(1);
    const invoices = mapComprobantesToInvoices(parsed, 2025);
    expect(invoices[0].amount).toBeCloseTo(1210, 2);
  });
});
