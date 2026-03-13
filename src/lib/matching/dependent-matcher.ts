/**
 * Matches education invoices to family dependents by checking if
 * a dependent's name tokens appear in the invoice text fields.
 */

interface DependentCandidate {
  id: string;
  nombre: string;
  apellido: string;
}

export interface MatchResult {
  dependentId: string | null;
  reason: "matched" | "ambiguous" | "no_match";
  matchedName?: string;
}

/**
 * Normalize a string for comparison: lowercase, strip accents, trim.
 */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Tokenize a string into non-empty words.
 */
export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[\s,.\-;:()]+/)
    .filter((t) => t.length > 0);
}

/**
 * Check if ALL tokens from a dependent's name appear in the text tokens.
 * Both nombre and apellido tokens must be present.
 */
function dependentMatchesText(dependent: DependentCandidate, textTokens: string[]): boolean {
  const nameTokens = tokenize(`${dependent.nombre} ${dependent.apellido}`);
  if (nameTokens.length === 0) return false;
  return nameTokens.every((token) => textTokens.includes(token));
}

/**
 * Attempt to match an invoice to a family dependent by scanning the
 * invoice's description and provider name for dependent name tokens.
 *
 * Returns the matched dependent ID if exactly one match is found,
 * null if zero or multiple matches (ambiguous).
 */
export function matchDependent(invoiceText: string, dependents: DependentCandidate[]): MatchResult {
  if (!invoiceText.trim() || dependents.length === 0) {
    return { dependentId: null, reason: "no_match" };
  }

  const textTokens = tokenize(invoiceText);
  const matches = dependents.filter((d) => dependentMatchesText(d, textTokens));

  if (matches.length === 1) {
    return {
      dependentId: matches[0].id,
      reason: "matched",
      matchedName: `${matches[0].nombre} ${matches[0].apellido}`,
    };
  }

  if (matches.length > 1) {
    return { dependentId: null, reason: "ambiguous" };
  }

  return { dependentId: null, reason: "no_match" };
}

/**
 * Build the searchable text from invoice fields.
 */
export function buildInvoiceText(fields: {
  description?: string | null;
  providerName?: string | null;
}): string {
  return [fields.description, fields.providerName].filter(Boolean).join(" ");
}
