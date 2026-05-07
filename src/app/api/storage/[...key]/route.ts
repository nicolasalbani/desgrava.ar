import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { localStoragePath, verifyLocalToken } from "@/lib/storage/local-fs-storage";

/**
 * Local-fs storage serve route. Active only when SUPABASE_URL/SERVICE_ROLE_KEY
 * are absent (dev/CI). In production this never gets called: `getSignedUrl()`
 * returns a supabase.co URL, so the 302 redirect skips this handler entirely.
 *
 * Auth model: HMAC-signed URL with a unix expiry. The token is over `key +
 * "\n" + expires`, signed with NEXTAUTH_SECRET. No session check — the signed
 * URL is the auth (mirrors Supabase's signed-URL semantics so consumers don't
 * need a per-driver branch).
 */

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

function isLocalMode(): boolean {
  return !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  // Defense in depth: refuse to serve from disk if Supabase is configured.
  if (!isLocalMode()) {
    return new Response("Not found", { status: 404 });
  }

  const { key: keyParts } = await params;
  if (!keyParts || keyParts.length === 0) {
    return new Response("Missing key", { status: 400 });
  }
  const key = keyParts.map(decodeURIComponent).join("/");

  const token = req.nextUrl.searchParams.get("token");
  const expiresStr = req.nextUrl.searchParams.get("expires");
  if (!token || !expiresStr) {
    return new Response("Missing token", { status: 400 });
  }
  const expires = parseInt(expiresStr, 10);
  if (!verifyLocalToken(key, expires, token)) {
    return new Response("Invalid or expired token", { status: 403 });
  }

  let body: Buffer;
  try {
    body = await readFile(localStoragePath(key));
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const ext = key.toLowerCase().split(".").pop() ?? "";
  const mime = EXT_TO_MIME[ext] ?? "application/octet-stream";
  // `Uint8Array.from` returns Uint8Array<ArrayBuffer>, which BodyInit accepts;
  // Buffer's Uint8Array<ArrayBufferLike> is rejected by TS strict mode.
  return new Response(Uint8Array.from(body), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
