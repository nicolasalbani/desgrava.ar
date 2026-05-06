import type { NextRequest } from "next/server";

/**
 * Verify that an incoming cron request carries the configured secret.
 *
 * Supports two formats so the same route handler works under both schedulers:
 *  - GitHub Actions (current): `x-cron-secret: <CRON_SECRET>` header
 *  - Vercel Cron: `Authorization: Bearer <CRON_SECRET>` header
 *
 * Returns true if the request is authorized. Returns false if the secret is
 * missing or doesn't match.
 */
export function verifyCronAuth(req: Pick<NextRequest, "headers">): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const xHeader = req.headers.get("x-cron-secret");
  if (xHeader && xHeader === expected) return true;

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && auth.slice("Bearer ".length) === expected) {
    return true;
  }

  return false;
}
