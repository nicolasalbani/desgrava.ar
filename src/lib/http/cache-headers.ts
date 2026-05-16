/**
 * Build a per-user `Cache-Control` header value that allows the browser to
 * reuse a recent response across navigations (router cache + back-forward
 * cache) while still revalidating in the background.
 *
 * Always `private` — never `public`. Per-user payloads (counts, job state,
 * subscription info) must never be shared by an intermediate CDN, or one
 * user's data could leak to another.
 *
 * @param maxAge fresh window in seconds — within this, the browser serves
 *   the cached response without revalidating
 * @param swr stale-while-revalidate window in seconds — after `maxAge`, the
 *   browser serves the stale response immediately while firing a background
 *   fetch to refresh it
 */
export function withPrivateSWR(maxAge: number, swr: number): string {
  if (maxAge < 0 || swr < 0) {
    throw new Error("Cache-Control durations must be non-negative");
  }
  return `private, max-age=${maxAge}, stale-while-revalidate=${swr}`;
}

/** `no-store` — never cache. Used when the response must always be fresh
 *  (e.g. polling endpoints with an in-flight job state). */
export const NO_STORE = "no-store" as const;

/** True if the header is per-user (`private`) and not cacheable by a shared
 *  CDN. Used by unit tests to guard against accidental `public` leaks. */
export function isPrivateCacheHeader(value: string): boolean {
  if (value === NO_STORE) return true;
  const directives = value.split(",").map((d) => d.trim().toLowerCase());
  if (directives.includes("public")) return false;
  return directives.includes("private");
}
