import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import type { ChatMessage } from "@/lib/soporte/types";

const TITLE_MIN_MESSAGES = 4;

export function shouldGenerateTitle(messageCount: number, currentTitle: string | null): boolean {
  return currentTitle === null && messageCount >= TITLE_MIN_MESSAGES;
}

const TITLE_PROMPT =
  "Resumí esta conversación de soporte en 4 a 6 palabras en español. Devolvé únicamente el título, sin comillas, sin punto final.";

function formatMessagesForTitle(messages: ChatMessage[]): string {
  return messages
    .slice(0, 8)
    .map((m) => `${m.role === "user" ? "Usuario" : "Asistente"}: ${m.content}`)
    .join("\n");
}

export async function generateConversationTitle(
  conversationId: string,
  messages: ChatMessage[],
  openai: OpenAI,
): Promise<void> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 30,
    messages: [
      { role: "system", content: TITLE_PROMPT },
      { role: "user", content: formatMessagesForTitle(messages) },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim();
  if (!raw) return;

  const cleaned = raw.replace(/^["'¿¡]+|["'.]+$/g, "").slice(0, 80);
  if (!cleaned) return;

  await prisma.supportConversation.update({
    where: { id: conversationId },
    data: { title: cleaned },
  });
}
