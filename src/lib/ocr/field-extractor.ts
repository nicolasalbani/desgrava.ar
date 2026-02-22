export interface ExtractedFields {
  cuit: string | null;
  invoiceType: string | null;
  invoiceNumber: string | null; // "XXXXX-YYYYYYYY" (punto de venta + comp. nro)
  amount: number | null;
  date: string | null;
  providerName: string | null;
  confidence: number;
}

const CUIT_PATTERN = /\b(20|23|24|27|30|33|34)-?\d{8}-?\d\b/g;
const AMOUNT_PATTERNS = [
  /IMPORTE\s+TOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
  /TOTAL\s+A\s+PAGAR\s*:?\s*\$?\s*([\d.,]+)/i,
  /IMP\.\s*TOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
  /NETO\s+GRAVADO\s*:?\s*\$?\s*([\d.,]+)/i,
  /(?<!SUB)TOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
];

const INVOICE_TYPE_PATTERNS: [RegExp, string][] = [
  [/FACTURA\s*"?A"?/i, "FACTURA_A"],
  [/FACTURA\s*"?B"?/i, "FACTURA_B"],
  [/FACTURA\s*"?C"?/i, "FACTURA_C"],
  [/NOTA\s+DE?\s*CR[ÉE]DITO\s*"?A"?/i, "NOTA_CREDITO_A"],
  [/NOTA\s+DE?\s*CR[ÉE]DITO\s*"?B"?/i, "NOTA_CREDITO_B"],
  [/NOTA\s+DE?\s*CR[ÉE]DITO\s*"?C"?/i, "NOTA_CREDITO_C"],
  [/NOTA\s+DE?\s*D[ÉE]BITO\s*"?A"?/i, "NOTA_DEBITO_A"],
  [/NOTA\s+DE?\s*D[ÉE]BITO\s*"?B"?/i, "NOTA_DEBITO_B"],
  [/NOTA\s+DE?\s*D[ÉE]BITO\s*"?C"?/i, "NOTA_DEBITO_C"],
  [/RECIBO/i, "RECIBO"],
  [/TICKET/i, "TICKET"],
];

const DATE_PATTERN = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/;

// Matches "Punto de Venta: XXXXX Comp. Nro: YYYYYYYY" or "Pto. Vta.: XXXXX" + "Comp. Nro.: YYYYYYYY"
const INVOICE_NUMBER_PATTERNS = [
  // Combined format with labels: Punto de Venta: 00001 Comp. Nro: 00012345
  /(?:Punto\s+de\s+Venta|Pto\.?\s*Vta\.?)\s*:?\s*(\d{1,5})\s+(?:Comp\.?\s*Nro\.?)\s*:?\s*(\d{1,8})/i,
  // Hyphenated format with labels: Pto. Vta.: 00001 - Comp. Nro.: 00012345
  /(?:Punto\s+de\s+Venta|Pto\.?\s*Vta\.?)\s*:?\s*(\d{1,5})\s*[-–—]\s*(?:Comp\.?\s*Nro\.?)\s*:?\s*(\d{1,8})/i,
  // N° with dash/em-dash: N° 0006 — 00140862
  /N[ºº°]?\s*\.?\s*:?\s*(\d{4,5})\s*[-–—]\s*(\d{5,8})/i,
  // N° with whitespace only (no dash): N° 0006 00140862
  /N[ºº°]?\s*\.?\s*:?\s*(\d{4,5})\s+(\d{5,8})/i,
];

// Fallback patterns for split PDF layouts where punto de venta and comp. nro
// end up on different lines due to absolute text positioning
const COMP_NRO_FALLBACK = /N[ºº°]?\s*\.?\s*:?\s*(\d{8})\b/i;
const PTO_VENTA_FALLBACK = /\b(\d{4,5})\s+[ABC]\s+cod\./i;

function parseArgentineAmount(raw: string): number | null {
  const cleaned = raw.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function extractFields(text: string): ExtractedFields {
  let fieldsFound = 0;
  const totalFields = 5;

  const cuitMatches = text.match(CUIT_PATTERN);
  const cuit = cuitMatches ? cuitMatches[0].replace(/-/g, "") : null;
  if (cuit) fieldsFound++;

  let invoiceType: string | null = null;
  for (const [pattern, type] of INVOICE_TYPE_PATTERNS) {
    if (pattern.test(text)) {
      invoiceType = type;
      fieldsFound++;
      break;
    }
  }

  let amount: number | null = null;
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      amount = parseArgentineAmount(match[1]);
      if (amount !== null) {
        fieldsFound++;
        break;
      }
    }
  }

  let date: string | null = null;
  const dateMatch = text.match(DATE_PATTERN);
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    const fullYear = year.length === 2 ? "20" + year : year;
    date = fullYear + "-" + month.padStart(2, "0") + "-" + day.padStart(2, "0");
    fieldsFound++;
  }

  let invoiceNumber: string | null = null;
  for (const pattern of INVOICE_NUMBER_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const ptoVenta = match[1].padStart(5, "0");
      const compNro = match[2].padStart(8, "0");
      invoiceNumber = `${ptoVenta}-${compNro}`;
      fieldsFound++;
      break;
    }
  }

  // Fallback for split PDF layouts: comp. nro near N° and punto de venta near invoice type code
  if (!invoiceNumber) {
    const compMatch = text.match(COMP_NRO_FALLBACK);
    const ptoMatch = text.match(PTO_VENTA_FALLBACK);
    if (compMatch && ptoMatch) {
      const ptoVenta = ptoMatch[1].padStart(5, "0");
      const compNro = compMatch[1].padStart(8, "0");
      invoiceNumber = `${ptoVenta}-${compNro}`;
      fieldsFound++;
    }
  }

  let providerName: string | null = null;
  const nameMatch = text.match(
    /(?:RAZ[OÓ]N\s+SOCIAL|DENOMINACI[OÓ]N|NOMBRE)\s*:?\s*(.+)/i
  );
  if (nameMatch) {
    // Strip trailing invoice field labels that end up on the same line
    // due to PDF column layout being merged into a single text line
    providerName = nameMatch[1]
      .replace(
        /\s+(?:Fecha\s+de\s|Punto\s+de\s+Venta|Comp\.\s*Nro|CUIT\s*:|Ingresos\s+Brutos|Condici[oó]n\s|Domicilio|Per[ií]odo|COD\.\s*\d|C\.U\.I\.T).*$/i,
        ""
      )
      .trim()
      .substring(0, 100);
  }

  const confidence = fieldsFound / totalFields;

  return { cuit, invoiceType, invoiceNumber, amount, date, providerName, confidence };
}
