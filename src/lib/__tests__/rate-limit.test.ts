import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests within the limit", () => {
    const key = "test-allow";
    const opts = { limit: 3, windowMs: 60_000 };

    expect(rateLimit(key, opts)).toEqual({ success: true, remaining: 2 });
    expect(rateLimit(key, opts)).toEqual({ success: true, remaining: 1 });
    expect(rateLimit(key, opts)).toEqual({ success: true, remaining: 0 });
  });

  it("blocks requests over the limit", () => {
    const key = "test-block";
    const opts = { limit: 2, windowMs: 60_000 };

    rateLimit(key, opts);
    rateLimit(key, opts);
    expect(rateLimit(key, opts)).toEqual({ success: false, remaining: 0 });
  });

  it("resets after the window expires", () => {
    const key = "test-reset";
    const opts = { limit: 1, windowMs: 1000 };

    rateLimit(key, opts);
    expect(rateLimit(key, opts)).toEqual({ success: false, remaining: 0 });

    vi.advanceTimersByTime(1001);

    expect(rateLimit(key, opts)).toEqual({ success: true, remaining: 0 });
  });

  it("tracks different keys independently", () => {
    const opts = { limit: 1, windowMs: 60_000 };

    expect(rateLimit("key-a", opts).success).toBe(true);
    expect(rateLimit("key-a", opts).success).toBe(false);
    expect(rateLimit("key-b", opts).success).toBe(true);
  });

  it("returns correct remaining count", () => {
    const key = "test-remaining";
    const opts = { limit: 5, windowMs: 60_000 };

    expect(rateLimit(key, opts).remaining).toBe(4);
    expect(rateLimit(key, opts).remaining).toBe(3);
    expect(rateLimit(key, opts).remaining).toBe(2);
    expect(rateLimit(key, opts).remaining).toBe(1);
    expect(rateLimit(key, opts).remaining).toBe(0);
    expect(rateLimit(key, opts).remaining).toBe(0); // blocked
  });
});
