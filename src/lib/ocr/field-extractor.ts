export interface ExtractedFields {
  cuit: string | null;
  invoiceType: string | null;
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

function parseArgentineAmount(raw: string): number | null {
  const cleaned = raw.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function extractFields(text: string): ExtractedFields {
  let fieldsFound = 0;
  const totalFields = 4;

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

  let providerName: string | null = null;
  const nameMatch = text.match(
    /(?:RAZ[OÓ]N\s+SOCIAL|DENOMINACI[OÓ]N|NOMBRE)\s*:?\s*(.+)/i
  );
  if (nameMatch) {
    providerName = nameMatch[1].trim().substring(0, 100);
  }

  const confidence = fieldsFound / totalFields;

  return { cuit, invoiceType, amount, date, providerName, confidence };
}
