import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { parseCatalogCallbackData } from "@/lib/telegram-callback";
import { approveCatalogProposal, rejectCatalogProposal } from "@/lib/catalog/review-non-deductible";
import { editCatalogReviewMessage } from "@/lib/telegram";
import { sendNewDeductibleInvoicesEmail } from "@/lib/email";

interface TelegramCallbackQuery {
  id: string;
  from?: { username?: string; first_name?: string };
  data?: string;
  message?: { message_id?: number };
}

interface TelegramUpdate {
  callback_query?: TelegramCallbackQuery;
}

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  }).catch(() => {
    // Swallow — Telegram requires a response to the POST but we don't care about the ACK
  });
}

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const providedSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await req.json()) as TelegramUpdate;
  const cb = update.callback_query;
  if (!cb || !cb.data) {
    return NextResponse.json({ received: true });
  }

  const parsed = parseCatalogCallbackData(cb.data);
  if (!parsed) {
    await answerCallbackQuery(cb.id, "Callback inválido");
    return NextResponse.json({ received: true });
  }

  const admin = cb.from?.username ?? cb.from?.first_name ?? "admin";
  const messageIdFromCb = cb.message?.message_id ?? null;

  if (parsed.action === "approve") {
    const result = await approveCatalogProposal(parsed.cuit);
    if (result.status === "approved") {
      const messageId = result.telegramMessageId ?? messageIdFromCb;
      const newCategory = result.newCategory ?? "";
      const emails = result.affectedUserEmails ?? [];

      after(async () => {
        if (messageId != null) {
          try {
            await editCatalogReviewMessage(messageId, `✅ Aprobado por ${admin} → ${newCategory}`);
          } catch (err) {
            console.error("Failed to edit Telegram message:", err);
          }
        }
        await Promise.allSettled(
          emails.map((email) =>
            sendNewDeductibleInvoicesEmail(email).catch((err) => {
              console.error(`Failed to send notification email to ${email}:`, err);
            }),
          ),
        );
      });

      await answerCallbackQuery(cb.id, "Aprobado");
    } else if (result.status === "already_resolved") {
      await answerCallbackQuery(cb.id, "Ya resuelto");
    } else {
      await answerCallbackQuery(cb.id, "No encontrado");
    }
  } else {
    const result = await rejectCatalogProposal(parsed.cuit);
    if (result.status === "rejected") {
      const messageId = result.telegramMessageId ?? messageIdFromCb;

      after(async () => {
        if (messageId != null) {
          try {
            await editCatalogReviewMessage(messageId, `❌ Rechazado por ${admin}`);
          } catch (err) {
            console.error("Failed to edit Telegram message:", err);
          }
        }
      });

      await answerCallbackQuery(cb.id, "Rechazado");
    } else if (result.status === "already_resolved") {
      await answerCallbackQuery(cb.id, "Ya resuelto");
    } else {
      await answerCallbackQuery(cb.id, "No encontrado");
    }
  }

  return NextResponse.json({ received: true });
}
