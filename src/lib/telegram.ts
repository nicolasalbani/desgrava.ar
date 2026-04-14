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
