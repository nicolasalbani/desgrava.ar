import { NextResponse } from "next/server";
import { canUserWrite } from "./access";

/**
 * Checks if the user has write access (active subscription).
 * Returns a 403 response if not, or null if access is granted.
 * Use at the top of POST/PUT/PATCH/DELETE handlers.
 */
export async function requireWriteAccess(userId: string): Promise<NextResponse | null> {
  const hasAccess = await canUserWrite(userId);
  if (!hasAccess) {
    return NextResponse.json(
      {
        error: "Tu suscripción venció. Suscribite para seguir usando todas las funcionalidades.",
        code: "SUBSCRIPTION_REQUIRED",
      },
      { status: 403 },
    );
  }
  return null;
}
