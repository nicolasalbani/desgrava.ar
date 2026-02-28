import crypto from "crypto";

/**
 * Generate a cryptographically random ingest token.
 * 24 chars of base64url = 18 random bytes = ~144 bits of entropy.
 */
export function generateIngestToken(): string {
  return crypto.randomBytes(18).toString("base64url");
}

/**
 * Construct the full ingest email address for a given token.
 */
export function getIngestEmail(token: string): string {
  const domain = process.env.INGEST_EMAIL_DOMAIN || "ingest.desgrava.ar";
  return `${token}@${domain}`;
}

/**
 * Extract the token from a full ingest email address.
 * Returns null if the address doesn't match the expected domain.
 */
export function extractTokenFromEmail(email: string): string | null {
  const domain = process.env.INGEST_EMAIL_DOMAIN || "ingest.desgrava.ar";
  const escapedDomain = domain.replace(/\./g, "\\.");
  const match = email.match(
    new RegExp(`^(.+)@${escapedDomain}$`, "i")
  );
  return match?.[1] ?? null;
}
