import crypto from "crypto";

export const INVITE_CODES = ["BETA2026"];

export function createInviteToken(code: string): string {
  const payload = Buffer.from(JSON.stringify({ code, ts: Date.now() })).toString("base64url");
  const sig = crypto
    .createHmac("sha256", process.env.NEXTAUTH_SECRET!)
    .update(payload)
    .digest("hex");
  return `${payload}.${sig}`;
}

export function validateInviteToken(token: string): boolean {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return false;

    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);

    const expectedSig = crypto
      .createHmac("sha256", process.env.NEXTAUTH_SECRET!)
      .update(payload)
      .digest("hex");

    if (
      sig.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
    ) {
      return false;
    }

    const { ts } = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    // 15-minute expiry
    return Date.now() - ts < 15 * 60 * 1000;
  } catch {
    return false;
  }
}
