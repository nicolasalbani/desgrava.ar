import Redis, { type RedisOptions } from "ioredis";
import { randomBytes } from "node:crypto";

/**
 * Redis-backed job queue and per-user distributed locks.
 *
 * Both Vercel API routes and worker processes connect to the same `REDIS_URL`.
 * The queue is a FIFO list (`LPUSH` / `BRPOP`); per-user serialization is
 * enforced by a token-stamped `SET NX EX` lock, released via a Lua script that
 * only deletes the key if the stored token matches the caller's. This protects
 * against a slow worker losing its lease and a new owner taking over: the slow
 * worker can't accidentally release the new owner's lock when it finally
 * finishes.
 */

export const QUEUE_KEY = "desgrava:jobs:queue";
export const USER_LOCK_PREFIX = "desgrava:user-lock:";

export function userLockKey(userId: string): string {
  return `${USER_LOCK_PREFIX}${userId}`;
}

export function generateLockToken(): string {
  return randomBytes(16).toString("hex");
}

// `GET` then `DEL`, but only if the stored value matches our token.
export const RELEASE_LOCK_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`.trim();

// `EXPIRE` only if the stored value matches our token (heartbeat).
export const EXTEND_LOCK_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("EXPIRE", KEYS[1], ARGV[2])
else
  return 0
end
`.trim();

let _client: Redis | null = null;

function getClient(): Redis {
  if (_client) return _client;
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "REDIS_URL is not set. Both Vercel and the worker pool require Redis to dispatch jobs.",
    );
  }

  // `maxRetriesPerRequest: null` is required so blocking commands like BRPOP
  // don't get aborted by ioredis's per-request retry counter. `enableReadyCheck`
  // is left default; `lazyConnect` is false so we surface connection failures
  // at the first command rather than on the first publish/consume.
  const options: RedisOptions = {
    maxRetriesPerRequest: null,
  };

  _client = new Redis(url, options);
  return _client;
}

/** LPUSH a job ID onto the queue. Vercel API routes call this. */
export async function publishJob(jobId: string): Promise<void> {
  await getClient().lpush(QUEUE_KEY, jobId);
}

/**
 * BRPOP one job ID off the queue, blocking up to `timeoutSec` seconds.
 * Returns null on timeout. Workers loop on this.
 */
export async function consumeJob(timeoutSec: number): Promise<string | null> {
  const result = await getClient().brpop(QUEUE_KEY, timeoutSec);
  if (!result) return null;
  // ioredis returns [key, value]
  return result[1];
}

/**
 * Try to acquire a lock for `userId`. Returns true if acquired, false if held.
 * The caller must keep `token` to release/extend. TTL is the lease duration.
 */
export async function acquireUserLock(
  userId: string,
  token: string,
  ttlSec: number,
): Promise<boolean> {
  const result = await getClient().set(userLockKey(userId), token, "EX", ttlSec, "NX");
  return result === "OK";
}

/**
 * Release the lock for `userId` IFF we still own the token. Returns true if a
 * key was deleted. Returns false if the lock had already expired or been
 * stolen by another worker — that's not an error here, just a no-op.
 */
export async function releaseUserLock(userId: string, token: string): Promise<boolean> {
  const result = (await getClient().eval(RELEASE_LOCK_LUA, 1, userLockKey(userId), token)) as
    | number
    | string;
  return Number(result) === 1;
}

/** Heartbeat: extend the lock TTL if (and only if) we still own the token. */
export async function extendUserLock(
  userId: string,
  token: string,
  ttlSec: number,
): Promise<boolean> {
  const result = (await getClient().eval(
    EXTEND_LOCK_LUA,
    1,
    userLockKey(userId),
    token,
    String(ttlSec),
  )) as number | string;
  return Number(result) === 1;
}

/** Close the underlying Redis connection. Used by graceful worker shutdown. */
export async function disconnect(): Promise<void> {
  if (_client) {
    try {
      await _client.quit();
    } catch {
      _client.disconnect();
    }
    _client = null;
  }
}
