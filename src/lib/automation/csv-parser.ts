/**
 * Parser for CSV exports from ARCA's "Mis Comprobantes" service.
 *
 * The server-side CSV (descargarComprobantes.do?tf=csv) uses semicolons and has 30 columns:
 * "Fecha de Emisión";"Tipo de Comprobante";"Punto de Venta";"Número Desde";"Número Hasta";
 * "Cód. Autorización";"Tipo Doc. Emisor";"Nro. Doc. Emisor";"Denominación Emisor";
 * "Tipo Doc. Receptor";"Nro. Doc. Receptor";"Tipo Cambio";"Moneda";
 * "Imp. Neto Gravado IVA 0%";"IVA 2,5%"; ... ;"Imp. Total"
 *
 * - Dates are YYYY-MM-DD
 * - Tipo is a raw numeric code (1, 6, 11, etc.)
 * - Numbers use Argentine format (comma as decimal: "306800,00")
 * - Header row is quoted, data rows are unquoted
 */

export interface ParsedComprobante {
  fecha: string; // YYYY-MM-DD (from CSV) or dd/mm/yyyy
  tipo: string; // e.g. "1", "6", "11" (raw ARCA code) or "6 - Factura B"
  puntoDeVenta: string; // e.g. "1208", "6"
  numeroDesde: string; // e.g. "66512", "125146"
  cuitEmisor: string; // raw digits: "30612865333"
  denominacionEmisor: string;
  importeTotal: number;
  moneda: string; // "PES", "DOL", "USD", etc.
  tipoCambio: number; // exchange rate (1 for ARS, >1 for foreign currencies)
}

export interface MappedInvoice {
  providerCuit: string; // raw digits: "20123456789"
  providerName: string;
  invoiceType: string; // InvoiceType enum value
  invoiceNumber: string; // "XXXXX-YYYYYYYY"
  invoiceDate: Date;
  amount: number;
  fiscalYear: number;
  fiscalMonth: number;
}

/**
 * Map "Mis Comprobantes" tipo codes to our InvoiceType enum.
 * ARCA CSV uses raw numeric codes: "1", "6", "11", etc. (no leading zeros).
 * We normalize to unpadded strings for matching.
 */
const TIPO_CODE_MAP: Record<string, string> = {
  "1": "FACTURA_A",
  "2": "NOTA_DEBITO_A",
  "3": "NOTA_CREDITO_A",
  "4": "RECIBO", // Recibo A
  "6": "FACTURA_B",
  "7": "NOTA_DEBITO_B",
  "8": "NOTA_CREDITO_B",
  "9": "RECIBO", // Recibo B
  "11": "FACTURA_C",
  "12": "NOTA_DEBITO_C",
  "13": "NOTA_CREDITO_C",
  "15": "RECIBO", // Recibo C
  "83": "TICKET",
};

/**
 * Also match by text description when code is not present.
 */
const TIPO_TEXT_MAP: Record<string, string> = {
  "factura a": "FACTURA_A",
  "facturas a": "FACTURA_A",
  "factura b": "FACTURA_B",
  "facturas b": "FACTURA_B",
  "factura c": "FACTURA_C",
  "facturas c": "FACTURA_C",
  "nota de debito a": "NOTA_DEBITO_A",
  "nota de débito a": "NOTA_DEBITO_A",
  "nota de debito b": "NOTA_DEBITO_B",
  "nota de débito b": "NOTA_DEBITO_B",
  "nota de debito c": "NOTA_DEBITO_C",
  "nota de débito c": "NOTA_DEBITO_C",
  "nota de credito a": "NOTA_CREDITO_A",
  "nota de crédito a": "NOTA_CREDITO_A",
  "nota de credito b": "NOTA_CREDITO_B",
  "nota de crédito b": "NOTA_CREDITO_B",
  "nota de credito c": "NOTA_CREDITO_C",
  "nota de crédito c": "NOTA_CREDITO_C",
  recibo: "RECIBO",
  recibos: "RECIBO",
  ticket: "TICKET",
  tickets: "TICKET",
};

/**
 * Parse a raw CSV string from Mis Comprobantes into structured rows.
 */
export function parseComprobantesCSV(csvContent: string): ParsedComprobante[] {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) return [];

  const headerLine = lines[0];

  // Detect separator from header: ARCA CSV uses semicolons, some exports use commas.
  // If the header contains semicolons (outside quotes), use semicolons for all lines.
  const separator = detectSeparator(headerLine);

  const headers = parseCSVLine(headerLine, separator).map((h) => normalizeHeader(h));

  const colIndex = resolveColumnIndices(headers);
  if (colIndex.importeTotal === -1 || colIndex.cuitEmisor === -1) {
    throw new Error(
      "CSV no tiene las columnas requeridas (Imp. Total, Nro. Doc. Emisor/CUIT Emisor)",
    );
  }

  const results: ParsedComprobante[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i], separator);
    if (fields.length < 3) continue;

    const importeStr = getField(fields, colIndex.importeTotal);
    const importe = parseArgentineNumber(importeStr);
    if (isNaN(importe) || importe === 0) continue;

    const tipoCambioStr = getField(fields, colIndex.tipoCambio);
    const tipoCambio = tipoCambioStr ? parseArgentineNumber(tipoCambioStr) : 1;

    results.push({
      fecha: getField(fields, colIndex.fecha),
      tipo: getField(fields, colIndex.tipo),
      puntoDeVenta: getField(fields, colIndex.puntoDeVenta),
      numeroDesde: getField(fields, colIndex.numeroDesde),
      cuitEmisor: getField(fields, colIndex.cuitEmisor),
      denominacionEmisor: getField(fields, colIndex.denominacionEmisor),
      importeTotal: importe,
      moneda: getField(fields, colIndex.moneda) || "PES",
      tipoCambio: isNaN(tipoCambio) || tipoCambio <= 0 ? 1 : tipoCambio,
    });
  }

  return results;
}

/**
 * Map parsed comprobantes to invoice objects ready for DB insertion.
 */
export function mapComprobantesToInvoices(
  comprobantes: ParsedComprobante[],
  fiscalYear: number,
): MappedInvoice[] {
  return comprobantes
    .map((c) => {
      const invoiceType = resolveInvoiceType(c.tipo);
      if (!invoiceType) return null;

      const date = parseArgentineDate(c.fecha);
      if (!date) return null;

      const cuit = c.cuitEmisor.replace(/[-\s]/g, "");
      if (cuit.length < 10) return null;

      const puntoVenta = c.puntoDeVenta.padStart(5, "0");
      const numero = c.numeroDesde.padStart(8, "0");
      const invoiceNumber = `${puntoVenta}-${numero}`;

      // Convert foreign currency to ARS using the exchange rate
      const amountARS = c.tipoCambio > 1 ? c.importeTotal * c.tipoCambio : c.importeTotal;

      return {
        providerCuit: cuit,
        providerName: c.denominacionEmisor.trim(),
        invoiceType,
        invoiceNumber,
        invoiceDate: date,
        amount: Math.abs(amountARS),
        fiscalYear,
        fiscalMonth: date.getMonth() + 1,
      };
    })
    .filter((inv): inv is MappedInvoice => inv !== null);
}

/**
 * Build a deduplication key for an invoice.
 */
export function invoiceDedupeKey(
  providerCuit: string,
  invoiceNumber: string | null,
  fiscalYear: number,
): string {
  return `${providerCuit}|${invoiceNumber ?? ""}|${fiscalYear}`;
}

// ── Internal helpers ──────────────────────────────────────────

/**
 * Detect the field separator from a header line.
 * ARCA server-side CSV uses semicolons; some exports use commas.
 * We count unquoted semicolons vs commas — the one with more wins.
 */
function detectSeparator(headerLine: string): "," | ";" {
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;

  for (const ch of headerLine) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === ",") commas++;
      if (ch === ";") semicolons++;
    }
  }

  return semicolons >= commas ? ";" : ",";
}

function parseCSVLine(line: string, separator: "," | ";"): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === separator) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

interface ColumnIndices {
  fecha: number;
  tipo: number;
  puntoDeVenta: number;
  numeroDesde: number;
  cuitEmisor: number;
  denominacionEmisor: number;
  importeTotal: number;
  moneda: number;
  tipoCambio: number;
}

function resolveColumnIndices(headers: string[]): ColumnIndices {
  return {
    fecha: findColumn(headers, ["fecha"]),
    tipo: findColumn(headers, ["tipo"]),
    puntoDeVenta: findColumn(headers, ["punto de venta", "pto venta", "punto venta"]),
    numeroDesde: findColumn(headers, ["numero desde", "nro desde", "numero comp"]),
    cuitEmisor: findColumn(headers, [
      "nro doc emisor",
      "cuit emisor",
      "doc emisor",
      "nro documento emisor",
    ]),
    denominacionEmisor: findColumn(headers, [
      "denominacion emisor",
      "razon social",
      "emisor",
      "nombre emisor",
    ]),
    importeTotal: findColumn(headers, ["imp total", "importe total", "total"]),
    moneda: findColumn(headers, ["moneda"]),
    tipoCambio: findColumn(headers, ["tipo cambio", "tipo de cambio", "tc"]),
  };
}

function findColumn(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
}

function getField(fields: string[], index: number): string {
  if (index === -1 || index >= fields.length) return "";
  return fields[index].trim();
}

/**
 * Parse numbers in Argentine format: "1.234,56" or "1234.56"
 */
export function parseArgentineNumber(str: string): number {
  if (!str) return NaN;
  let cleaned = str.replace(/[$ ]/g, "").trim();

  // Detect Argentine format: has comma as decimal separator
  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }

  return parseFloat(cleaned);
}

/**
 * Parse dates in dd/mm/yyyy or YYYY-MM-DD format.
 * ARCA CSV exports use YYYY-MM-DD (ISO) format.
 */
export function parseArgentineDate(str: string): Date | null {
  if (!str) return null;

  // Try YYYY-MM-DD (ISO format — used in ARCA CSV exports)
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return new Date(year, month - 1, day);
  }

  // Try dd/mm/yyyy (Argentine format — used in UI display)
  const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return new Date(year, month - 1, day);
}

function resolveInvoiceType(tipoStr: string): string | null {
  if (!tipoStr) return null;

  // Try as raw numeric code (ARCA CSV uses "1", "6", "11", etc.)
  const rawCode = tipoStr.trim();
  if (/^\d+$/.test(rawCode)) {
    const mapped = TIPO_CODE_MAP[rawCode];
    if (mapped) return mapped;
  }

  // Try extracting code from "001 - Facturas A" or "6 - Factura B" format
  const codeMatch = tipoStr.match(/^(\d{1,3})\s*[-–]/);
  if (codeMatch) {
    const code = String(parseInt(codeMatch[1], 10)); // strip leading zeros
    const mapped = TIPO_CODE_MAP[code];
    if (mapped) return mapped;
  }

  // Try text matching
  const lower = tipoStr
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  for (const [text, type] of Object.entries(TIPO_TEXT_MAP)) {
    if (lower.includes(text)) return type;
  }

  // Default to FACTURA_B for unrecognized types (most common for consumers)
  return "FACTURA_B";
}
