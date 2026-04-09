import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createTrialSubscription } from "@/lib/subscription/create";

const DEV_PASSWORD = "DevPass123!";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const timestamp = Date.now();
  const email = `dev+${timestamp}@test.com`;
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 4); // low rounds for speed

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      emailVerified: new Date(), // auto-verify
    },
  });

  await createTrialSubscription(user.id);

  return NextResponse.json({ email, password: DEV_PASSWORD });
}
