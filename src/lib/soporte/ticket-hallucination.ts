/**
 * gpt-4o-mini sometimes narrates "ticket creado" / "voy a crear el reporte" without
 * actually invoking the `create_ticket` tool, leaving the user thinking a ticket was
 * filed when nothing happened. This module detects that pattern so the chat route can
 * force a corrective tool call.
 */

const FALSE_CLAIM_PATTERNS: RegExp[] = [
  /\bticket\s+creado\b/i,
  /\bcre[eé]\s+(el|un)\s+ticket\b/i,
  /\bhe\s+creado\s+(el|un)?\s*ticket\b/i,
  /\bse\s+ha?\s+creado\s+(el|un)\s+ticket\b/i,
  /\breporte\s+creado\b/i,
  // `\b` doesn't match between accented letter and space in JS regex, so use negative lookahead.
  /\bya\s+(lo\s+)?report[eé](?![a-zñ])/i,
  /\bya\s+(est[aá]|qued[oó])\s+creado\b/i,
  /\bsolicit[uú]d\s+(de\s+soporte\s+)?creada\b/i,
  /\bvoy\s+a\s+(crear|reportar|generar|abrir)\b/i,
];

/**
 * Returns true when the model's assistant text claims a ticket was created or is being
 * created but no `ticket_created` event has been emitted in this turn AND the
 * conversation does not already have a GitHub issue from a previous turn.
 */
export function claimsTicketCreationWithoutInvocation(
  content: string,
  options: { ticketEventEmitted: boolean; conversationAlreadyHasTicket: boolean },
): boolean {
  if (options.ticketEventEmitted) return false;
  if (options.conversationAlreadyHasTicket) return false;
  if (!content) return false;
  return FALSE_CLAIM_PATTERNS.some((p) => p.test(content));
}
