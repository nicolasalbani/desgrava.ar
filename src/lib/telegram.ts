import { buildCatalogCallbackData } from "@/lib/telegram-callback";

const TELEGRAM_API = "https://api.telegram.org";

function getConfig(): { token: string; chatId: string } | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;
  return { token, chatId };
}

export function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

async function sendMessage(text: string): Promise<void> {
  const config = getConfig();
  if (!config) return;

  const url = `${TELEGRAM_API}/bot${config.token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.chatId,
      text,
      parse_mode: "MarkdownV2",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}

export async function sendNewUserNotification(
  email: string,
  authMethod: "Google" | "Email/Contraseña",
): Promise<void> {
  const escaped = escapeMarkdownV2(email);
  const method = escapeMarkdownV2(authMethod);
  const text = `👤 *Nuevo usuario*\n\n*Email:* \`${escaped}\`\n*Método:* ${method}`;
  await sendMessage(text);
}

export async function sendNewTicketNotification(
  ticketId: string,
  subject: string,
  description: string,
  userEmail: string,
  pageUrl: string | null,
  automationJobId: string | null,
): Promise<void> {
  const truncated = description.length > 500 ? description.slice(0, 500) + "…" : description;

  let text = `🎫 *Nuevo ticket de soporte*\n\n`;
  text += `*ID:* \`${escapeMarkdownV2(ticketId)}\`\n`;
  text += `*Usuario:* \`${escapeMarkdownV2(userEmail)}\`\n`;
  text += `*Asunto:* ${escapeMarkdownV2(subject)}\n`;

  if (pageUrl) {
    text += `*Página:* ${escapeMarkdownV2(pageUrl)}\n`;
  }
  if (automationJobId) {
    text += `*Job:* \`${escapeMarkdownV2(automationJobId)}\`\n`;
  }

  text += `\n${escapeMarkdownV2(truncated)}`;

  await sendMessage(text);
}

export interface CatalogReviewProposalMessage {
  cuit: string;
  razonSocial: string | null;
  proposedCategory: string;
  invoiceCount: number;
  userCount: number;
  activityDescription: string | null;
}

export async function sendCatalogReviewProposal(
  proposal: CatalogReviewProposalMessage,
): Promise<number | null> {
  const config = getConfig();
  if (!config) return null;

  let text = `🔎 *Revisión de CUIT no deducible*\n\n`;
  text += `*CUIT:* \`${escapeMarkdownV2(proposal.cuit)}\`\n`;
  if (proposal.razonSocial) {
    text += `*Razón social:* ${escapeMarkdownV2(proposal.razonSocial)}\n`;
  }
  text += `*Categoría actual:* ${escapeMarkdownV2("NO_DEDUCIBLE")}\n`;
  text += `*Categoría propuesta:* ${escapeMarkdownV2(proposal.proposedCategory)}\n`;
  text += `*Comprobantes afectados:* ${proposal.invoiceCount}\n`;
  text += `*Usuarios afectados:* ${proposal.userCount}\n`;
  if (proposal.activityDescription) {
    text += `\n${escapeMarkdownV2(proposal.activityDescription)}`;
  }

  const inlineKeyboard = [
    [
      {
        text: "✅ Aprobar",
        callback_data: buildCatalogCallbackData("approve", proposal.cuit),
      },
      {
        text: "❌ Rechazar",
        callback_data: buildCatalogCallbackData("reject", proposal.cuit),
      },
    ],
  ];

  const url = `${TELEGRAM_API}/bot${config.token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.chatId,
      text,
      parse_mode: "MarkdownV2",
      reply_markup: { inline_keyboard: inlineKeyboard },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { ok: boolean; result?: { message_id?: number } };
  return data.result?.message_id ?? null;
}

export async function editCatalogReviewMessage(
  messageId: number,
  resolutionText: string,
): Promise<void> {
  const config = getConfig();
  if (!config) return;

  const url = `${TELEGRAM_API}/bot${config.token}/editMessageReplyMarkup`;
  // Remove the inline keyboard first (so the buttons disappear).
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    }),
  });

  // Send a reply that records the admin's decision.
  const replyUrl = `${TELEGRAM_API}/bot${config.token}/sendMessage`;
  const res = await fetch(replyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.chatId,
      reply_to_message_id: messageId,
      text: escapeMarkdownV2(resolutionText),
      parse_mode: "MarkdownV2",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}
