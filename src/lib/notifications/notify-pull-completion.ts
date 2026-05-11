import { prisma } from "@/lib/prisma";
import { sendNewDeductibleInvoicesEmail, sendNewDeductibleReceiptsEmail } from "@/lib/email";
import { shouldSendNotificationToday } from "@/lib/notifications/eligibility";

type PullKind = "comprobantes" | "recibos";

export async function notifyPullCompletion(
  userId: string,
  kind: PullKind,
  newDeducibleCount: number,
): Promise<void> {
  if (newDeducibleCount <= 0) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      preference: {
        select: {
          notifications: true,
          lastComprobantesNotifiedAt: true,
          lastRecibosNotifiedAt: true,
        },
      },
    },
  });

  if (!user?.email) return;
  if (user.preference?.notifications === false) return;

  const now = new Date();
  const lastNotifiedAt =
    kind === "comprobantes"
      ? (user.preference?.lastComprobantesNotifiedAt ?? null)
      : (user.preference?.lastRecibosNotifiedAt ?? null);

  if (!shouldSendNotificationToday(lastNotifiedAt, now)) return;

  try {
    if (kind === "comprobantes") {
      await sendNewDeductibleInvoicesEmail(user.email);
    } else {
      await sendNewDeductibleReceiptsEmail(user.email);
    }
  } catch (err) {
    console.error(`Failed to send ${kind} notification for user ${userId}:`, err);
    return;
  }

  const data =
    kind === "comprobantes" ? { lastComprobantesNotifiedAt: now } : { lastRecibosNotifiedAt: now };

  await prisma.userPreference.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}
