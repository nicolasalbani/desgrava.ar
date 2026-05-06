import { describe, it, expect } from "vitest";
import {
  EXTEND_LOCK_LUA,
  QUEUE_KEY,
  RELEASE_LOCK_LUA,
  USER_LOCK_PREFIX,
  generateLockToken,
  userLockKey,
} from "@/lib/queue/redis-queue";

describe("userLockKey", () => {
  it("namespaces the lock under the desgrava prefix", () => {
    expect(userLockKey("abc123")).toBe("desgrava:user-lock:abc123");
  });

  it("uses the exported prefix constant", () => {
    expect(userLockKey("u")).toBe(`${USER_LOCK_PREFIX}u`);
  });

  it("does not collide between distinct user ids", () => {
    expect(userLockKey("a")).not.toBe(userLockKey("b"));
  });
});

describe("queue key", () => {
  it("uses the desgrava namespace", () => {
    expect(QUEUE_KEY).toBe("desgrava:jobs:queue");
  });
});

describe("generateLockToken", () => {
  it("returns 32 hex chars (16 bytes)", () => {
    const token = generateLockToken();
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  it("produces unique tokens across calls", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 1000; i++) tokens.add(generateLockToken());
    expect(tokens.size).toBe(1000);
  });
});

describe("RELEASE_LOCK_LUA", () => {
  it("only deletes when the stored token matches", () => {
    expect(RELEASE_LOCK_LUA).toContain(`redis.call("GET", KEYS[1]) == ARGV[1]`);
    expect(RELEASE_LOCK_LUA).toContain(`redis.call("DEL", KEYS[1])`);
  });

  it("returns 0 when the token doesn't match", () => {
    expect(RELEASE_LOCK_LUA).toMatch(/else\s+return 0/);
  });
});

describe("EXTEND_LOCK_LUA", () => {
  it("only extends when the stored token matches", () => {
    expect(EXTEND_LOCK_LUA).toContain(`redis.call("GET", KEYS[1]) == ARGV[1]`);
    expect(EXTEND_LOCK_LUA).toContain(`redis.call("EXPIRE", KEYS[1], ARGV[2])`);
  });

  it("returns 0 when the token doesn't match", () => {
    expect(EXTEND_LOCK_LUA).toMatch(/else\s+return 0/);
  });
});
