import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

/**
 * Local-filesystem driver used when SUPABASE_URL is unset (dev/CI). Mirrors the
 * Supabase Storage interface used by `supabase-storage.ts`:
 *
 *   - blobs live at `.storage/<bucket>/<key>` under the repo root
 *   - signed URLs point at the local Next.js catch-all route
 *     `/api/storage/<key>?token=<HMAC>&expires=<unix>`, signed with
 *     `NEXTAUTH_SECRET` so they can't be forged
 *   - the route handler verifies the HMAC + expiry, then streams the file
 *
 * One bucket today (`comprobantes`) — hard-coded here because adding a second
 * one would require redesigning the route shape too. STORAGE_BUCKET stays
 * canonical in `supabase-storage.ts`; we duplicate the literal once.
 */

const STORAGE_ROOT_DIR = ".storage";
const BUCKET_DIR = "comprobantes";
const HMAC_ALGORITHM = "sha256";

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET must be set for local storage signed URLs.");
  }
  return secret;
}

/** Absolute filesystem path for a storage key under the repo root. */
export function localStoragePath(key: string): string {
  return resolve(process.cwd(), STORAGE_ROOT_DIR, BUCKET_DIR, key);
}

/** HMAC-sign `key + expires` and return hex. Pure: secret can be passed in for tests. */
export function signLocalToken(key: string, expires: number, secret?: string): string {
  return createHmac(HMAC_ALGORITHM, secret ?? getSecret())
    .update(`${key}\n${expires}`)
    .digest("hex");
}

/**
 * Verify token, then expiry. Returns false on:
 *   - past expiry,
 *   - length mismatch (early-out before timingSafeEqual which throws),
 *   - HMAC mismatch.
 */
export function verifyLocalToken(
  key: string,
  expires: number,
  token: string,
  secret?: string,
): boolean {
  if (!Number.isFinite(expires)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (expires < now) return false;
  const expected = signLocalToken(key, expires, secret);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export async function localUpload(key: string, body: Buffer | Uint8Array): Promise<void> {
  const path = localStoragePath(key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}

export async function localDownload(key: string): Promise<Buffer> {
  const path = localStoragePath(key);
  return readFile(path);
}

export async function localDelete(key: string): Promise<void> {
  const path = localStoragePath(key);
  await rm(path, { force: true });
}

/**
 * Build a signed URL pointing at the local catch-all route. TTL matches the
 * Supabase wrapper (default 60s). Encodes each segment of the key separately so
 * embedded slashes (e.g. `<userId>/<recordId>.<ext>`) survive routing.
 */
export function localSignedUrl(key: string, ttlSec: number): string {
  const expires = Math.floor(Date.now() / 1000) + ttlSec;
  const token = signLocalToken(key, expires);
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const encodedKey = key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${base}/api/storage/${encodedKey}?token=${token}&expires=${expires}`;
}
