import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTrialReminderEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in1Day = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

  // Find trialing subscriptions needing 7-day reminder
  const need7DayReminder = await prisma.subscription.findMany({
    where: {
      status: "TRIALING",
      trialEndDate: { lte: in7Days },
      trialReminder7DaySentAt: null,
    },
    include: { user: { select: { email: true } } },
  });

  // Find trialing subscriptions needing 1-day reminder
  const need1DayReminder = await prisma.subscription.findMany({
    where: {
      status: "TRIALING",
      trialEndDate: { lte: in1Day },
      trialReminder1DaySentAt: null,
    },
    include: { user: { select: { email: true } } },
  });

  let sent = 0;

  for (const sub of need7DayReminder) {
    if (!sub.user.email) continue;
    try {
      await sendTrialReminderEmail(sub.user.email, 7);
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { trialReminder7DaySentAt: now },
      });
      sent++;
    } catch (err) {
      console.error(`Failed to send 7-day reminder for subscription ${sub.id}:`, err);
    }
  }

  for (const sub of need1DayReminder) {
    if (!sub.user.email) continue;
    try {
      await sendTrialReminderEmail(sub.user.email, 1);
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { trialReminder1DaySentAt: now },
      });
      sent++;
    } catch (err) {
      console.error(`Failed to send 1-day reminder for subscription ${sub.id}:`, err);
    }
  }

  // Expire trials that have passed their end date
  const expired = await prisma.subscription.updateMany({
    where: {
      status: "TRIALING",
      trialEndDate: { lte: now },
    },
    data: { status: "EXPIRED" },
  });

  // Expire cancelled subscriptions past their period end
  const expiredCancelled = await prisma.subscription.updateMany({
    where: {
      status: "CANCELLED",
      currentPeriodEnd: { lte: now },
    },
    data: { status: "EXPIRED" },
  });

  return NextResponse.json({
    remindersSent: sent,
    trialsExpired: expired.count,
    cancelledExpired: expiredCancelled.count,
  });
}
