import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Thin wrapper around Supabase Storage for the `comprobantes` bucket.
 *
 * The bucket is private (no public reads). All access goes through this
 * module using the service-role key, which bypasses RLS. API routes
 * authenticate the user, then either:
 *   - call `getSignedUrl(...)` and 302-redirect the client to the short-lived
 *     signed URL (preferred — bandwidth bypasses Vercel), or
 *   - call `downloadFile(...)` and stream the bytes through Vercel.
 *
 * Storage keys follow `<userId>/<recordId>.<ext>` so a user's files are
 * trivially listable by prefix and so a row's path is derivable from its id.
 */

export const STORAGE_BUCKET = "comprobantes";

/**
 * Build the canonical storage key for a record.
 * `recordId` is the Invoice/Receipt/Presentacion primary key, which is unique
 * across the system, so collisions are impossible. The extension comes from
 * the original filename or mime type — see `inferExtension`.
 */
export function buildStorageKey(userId: string, recordId: string, extension: string): string {
  const cleanExt = extension.replace(/^\.+/, "").toLowerCase();
  return `${userId}/${recordId}.${cleanExt}`;
}

const MIME_EXTENSION_MAP: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/webp": "webp",
};

/**
 * Pick a file extension from the original filename if it has one, otherwise
 * derive from the mime type, otherwise default to `bin`. Extension is always
 * lowercased and free of leading dots.
 */
export function inferExtension(originalFilename: string | null, mimeType: string | null): string {
  if (originalFilename) {
    const lastDot = originalFilename.lastIndexOf(".");
    if (lastDot >= 0 && lastDot < originalFilename.length - 1) {
      return originalFilename.slice(lastDot + 1).toLowerCase();
    }
  }
  if (mimeType && MIME_EXTENSION_MAP[mimeType.toLowerCase()]) {
    return MIME_EXTENSION_MAP[mimeType.toLowerCase()];
  }
  return "bin";
}

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set on every host that reads or writes file blobs.",
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/**
 * Upload a buffer to Storage at `key`. Overwrites if the key exists.
 */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  mimeType: string,
): Promise<void> {
  const { error } = await getClient()
    .storage.from(STORAGE_BUCKET)
    .upload(key, body, { contentType: mimeType, upsert: true });
  if (error) {
    throw new Error(`Storage upload failed for ${key}: ${error.message}`);
  }
}

/**
 * Returns a signed URL the client can fetch directly from Supabase. The URL
 * is valid for `ttlSec` seconds and includes the file's mime type so browsers
 * preview PDFs / images inline.
 */
export async function getSignedUrl(key: string, ttlSec: number = 60): Promise<string> {
  const { data, error } = await getClient()
    .storage.from(STORAGE_BUCKET)
    .createSignedUrl(key, ttlSec);
  if (error || !data) {
    throw new Error(`Storage signed-url failed for ${key}: ${error?.message ?? "unknown"}`);
  }
  return data.signedUrl;
}

/**
 * Download bytes for a key. Use this for the worker (which inserts rows on
 * behalf of the user) and for any code path that needs the raw bytes
 * (e.g. OCR re-runs). Most user-facing reads should use `getSignedUrl`.
 */
export async function downloadFile(key: string): Promise<Buffer> {
  const { data, error } = await getClient().storage.from(STORAGE_BUCKET).download(key);
  if (error || !data) {
    throw new Error(`Storage download failed for ${key}: ${error?.message ?? "unknown"}`);
  }
  const buf = Buffer.from(await data.arrayBuffer());
  return buf;
}

/**
 * Best-effort delete. Errors are swallowed: a missing object is fine
 * (already deleted), and a transient Supabase failure shouldn't block the
 * caller from completing the row delete.
 */
export async function deleteFile(key: string): Promise<void> {
  try {
    await getClient().storage.from(STORAGE_BUCKET).remove([key]);
  } catch (err) {
    console.error(`Storage delete failed for ${key} (best-effort, swallowed):`, err);
  }
}
