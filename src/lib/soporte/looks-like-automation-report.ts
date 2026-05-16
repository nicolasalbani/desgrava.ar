import type { ChatMessage } from "@/lib/soporte/types";

/**
 * Heuristic: does the conversation history + ticket description suggest the user is
 * reporting a failed ARCA/SiRADIG automation? Used only to log a warning when the model
 * forgets to pass `automation_job_id` — does not block ticket creation.
 */
const AUTOMATION_KEYWORDS = [
  "siradig",
  "arca",
  "enviar",
  "envío",
  "envio",
  "deducción",
  "deduccion",
  "deducir",
  "automatización",
  "automatizacion",
  "automatización fallida",
  "comprobante",
  "factura",
  "recibo",
  "presentación",
  "presentacion",
  "trabajadora",
  "trabajador doméstico",
  "trabajador domestico",
  "carga de familia",
  "empleador",
  "perfil",
  "import",
];

export function looksLikeAutomationReport(messages: ChatMessage[], description: string): boolean {
  const text = [description, ...messages.map((m) => m.content)].join(" ").toLowerCase();

  return AUTOMATION_KEYWORDS.some((kw) => text.includes(kw));
}
