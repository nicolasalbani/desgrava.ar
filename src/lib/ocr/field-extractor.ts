export interface ExtractedFields {
  cuit: string | null;
  invoiceType: string | null;
  invoiceNumber: string | null; // "XXXXX-YYYYYYYY" (punto de venta + comp. nro)
  amount: number | null;
  date: string | null;
  providerName: string | null;
  confidence: number;
  // For rental invoices (ALQUILER_VIVIENDA): billing/contract period dates
  contractStartDate: string | null; // ISO YYYY-MM-DD
  contractEndDate: string | null; // ISO YYYY-MM-DD
}

const CUIT_PATTERN = /\b(20|23|24|27|30|33|34)-?\d{8}-?\d\b/g;
const AMOUNT_PATTERNS = [
  /IMPORTE\s+TOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
  /TOTAL\s+A\s+PAGAR\s*:?\s*\$?\s*([\d.,]+)/i,
  /IMP\.\s*TOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
  /NETO\s+GRAVADO\s*:?\s*\$?\s*([\d.,]+)/i,
  // USD invoices: ARS equivalent stated as "asciende a : $ 10173750,00"
  /asciende\s+a\s*:?\s*\$\s*([\d.,]+)/i,
  /(?<!SUB)TOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
];

const INVOICE_TYPE_PATTERNS: [RegExp, string][] = [
  // Tique-factura must be checked first (before FACTURA patterns to avoid false match)
  [/TIQUE[\s-]*FACTURA/i, "TIQUE_FACTURA_B"],
  // Reversed layout: type letter appears BEFORE the word FACTURA (e.g., Starlink PDFs)
  // Type A → mapped to B (SiRADIG does not accept type A comprobantes)
  [/\bA\b\s+FACTURA/i, "FACTURA_B"],
  [/\bB\b\s+FACTURA/i, "FACTURA_B"],
  [/\bC\b\s+FACTURA/i, "FACTURA_C"],
  // Standard layout: FACTURA followed by type letter (with or without surrounding quotes)
  // Use negative lookahead instead of \b to also exclude accented chars (e.g. "FACTURA CÓD" should not match C)
  [/FACTURA\s*"?A(?![A-Za-zÁÉÍÓÚáéíóúÑñ])/i, "FACTURA_B"],
  [/FACTURA\s*"?B(?![A-Za-zÁÉÍÓÚáéíóúÑñ])/i, "FACTURA_B"],
  [/FACTURA\s*"?C(?![A-Za-zÁÉÍÓÚáéíóúÑñ])/i, "FACTURA_C"],
  [/NOTA\s+DE?\s*CR[ÉE]DITO\s*"?A"?/i, "NOTA_CREDITO_B"],
  [/NOTA\s+DE?\s*CR[ÉE]DITO\s*"?B"?/i, "NOTA_CREDITO_B"],
  [/NOTA\s+DE?\s*CR[ÉE]DITO\s*"?C"?/i, "NOTA_CREDITO_C"],
  [/NOTA\s+DE?\s*D[ÉE]BITO\s*"?A"?/i, "NOTA_DEBITO_B"],
  [/NOTA\s+DE?\s*D[ÉE]BITO\s*"?B"?/i, "NOTA_DEBITO_B"],
  [/NOTA\s+DE?\s*D[ÉE]BITO\s*"?C"?/i, "NOTA_DEBITO_C"],
  // Nota de Venta al contado
  [/NOTA\s+DE?\s*VENTA.*B/i, "NOTA_VENTA_B"],
  [/NOTA\s+DE?\s*VENTA.*C/i, "NOTA_VENTA_C"],
  // ARCA fallback: detect type from comprobante code (COD. 011 = Factura C, etc.)
  // Reliable for ARCA-generated PDFs where the type letter and "FACTURA" end up on different lines
  // Both COD and CÓD (accented) variants are handled
  // Type A codes → mapped to B (SiRADIG does not accept type A)
  [/C[OÓ]D\.\s*001\b/i, "FACTURA_B"],
  [/C[OÓ]D\.\s*002\b/i, "NOTA_DEBITO_B"],
  [/C[OÓ]D\.\s*003\b/i, "NOTA_CREDITO_B"],
  [/C[OÓ]D\.\s*004\b/i, "RECIBO_B"],
  [/C[OÓ]D\.\s*006\b/i, "FACTURA_B"],
  [/C[OÓ]D\.\s*007\b/i, "NOTA_DEBITO_B"],
  [/C[OÓ]D\.\s*008\b/i, "NOTA_CREDITO_B"],
  [/C[OÓ]D\.\s*009\b/i, "RECIBO_B"],
  [/C[OÓ]D\.\s*011\b/i, "FACTURA_C"],
  [/C[OÓ]D\.\s*012\b/i, "NOTA_DEBITO_C"],
  [/C[OÓ]D\.\s*013\b/i, "NOTA_CREDITO_C"],
  [/C[OÓ]D\.\s*015\b/i, "RECIBO_C"],
  [/C[OÓ]D\.\s*083\b/i, "TIQUE_FACTURA_B"],
  [/RECIBO/i, "RECIBO_B"],
  [/TICKET/i, "TIQUE_FACTURA_B"],
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

function parseArgentineDate(ddmmyyyy: string): string | null {
  const parts = ddmmyyyy.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

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
  const nameMatch = text.match(/(?:RAZ[OÓ]N\s+SOCIAL|DENOMINACI[OÓ]N|NOMBRE)\s*:?\s*(.+)/i);
  if (nameMatch) {
    // Strip trailing invoice field labels that end up on the same line
    // due to PDF column layout being merged into a single text line
    providerName = nameMatch[1]
      .replace(
        /\s+(?:Fecha\s+de\s|Punto\s+de\s+Venta|Comp\.\s*Nro|CUIT\s*:|Ingresos\s+Brutos|Condici[oó]n\s|Domicilio|Per[ií]odo|COD\.\s*\d|C\.U\.I\.T).*$/i,
        "",
      )
      .trim()
      .substring(0, 100);
  }

  // Fallback: detect issuer company name by common Argentine legal suffixes
  // (handles invoices like Starlink where the name appears without a RAZÓN SOCIAL label)
  if (!providerName) {
    const companyMatch = text.match(
      /([A-ZÁÉÍÓÚÑ][a-zA-ZáéíóúÁÉÍÓÚñÑ0-9]+(?:\s+[A-Za-záéíóúÁÉÍÓÚñÑ0-9\.]+){0,4}\s+(?:S\.R\.L\.|S\.A\.S\.|S\.A\.U\.|S\.A\.))/,
    );
    if (companyMatch) {
      providerName = companyMatch[1].trim().substring(0, 100);
    }
  }

  // Extract billing/contract period dates (rental invoices: "Período Facturado Desde: DD/MM/YYYY Hasta: DD/MM/YYYY")
  let contractStartDate: string | null = null;
  let contractEndDate: string | null = null;
  const periodMatch = text.match(
    /Per[ií]odo\s+Facturado\s+Desde:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+Hasta:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
  );
  if (periodMatch) {
    contractStartDate = parseArgentineDate(periodMatch[1]);
    contractEndDate = parseArgentineDate(periodMatch[2]);
  }

  const confidence = fieldsFound / totalFields;

  return {
    cuit,
    invoiceType,
    invoiceNumber,
    amount,
    date,
    providerName,
    confidence,
    contractStartDate,
    contractEndDate,
  };
}
