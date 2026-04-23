import crypto from "crypto";

export type CatalogCallbackAction = "approve" | "reject";

const ACTION_CODE: Record<CatalogCallbackAction, string> = {
  approve: "a",
  reject: "r",
};

const CODE_ACTION: Record<string, CatalogCallbackAction> = {
  a: "approve",
  r: "reject",
};

function getSecret(): string | null {
  return process.env.TELEGRAM_WEBHOOK_SECRET ?? null;
}

function computeHmac(action: CatalogCallbackAction, cuit: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`${action}:${cuit}`).digest("hex").slice(0, 8);
}

export function buildCatalogCallbackData(action: CatalogCallbackAction, cuit: string): string {
  const secret = getSecret();
  if (!secret) throw new Error("TELEGRAM_WEBHOOK_SECRET is not configured");
  const hmac = computeHmac(action, cuit, secret);
  return `catalog:${ACTION_CODE[action]}:${cuit}:${hmac}`;
}

export interface ParsedCallback {
  action: CatalogCallbackAction;
  cuit: string;
}

export function parseCatalogCallbackData(data: string): ParsedCallback | null {
  const secret = getSecret();
  if (!secret) return null;

  const parts = data.split(":");
  if (parts.length !== 4) return null;
  const [prefix, code, cuit, hmac] = parts;
  if (prefix !== "catalog") return null;

  const action = CODE_ACTION[code];
  if (!action) return null;

  const expected = computeHmac(action, cuit, secret);
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(hmac, "hex");
  if (expectedBuf.length !== actualBuf.length) return null;
  if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) return null;

  return { action, cuit };
}
