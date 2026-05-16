import { describe, it, expect } from "vitest";
import { withPrivateSWR, isPrivateCacheHeader, NO_STORE } from "@/lib/http/cache-headers";

describe("withPrivateSWR", () => {
  it("builds a private SWR header with the given durations", () => {
    expect(withPrivateSWR(5, 30)).toBe("private, max-age=5, stale-while-revalidate=30");
  });

  it("allows zero durations", () => {
    expect(withPrivateSWR(0, 0)).toBe("private, max-age=0, stale-while-revalidate=0");
  });

  it("throws on negative durations", () => {
    expect(() => withPrivateSWR(-1, 30)).toThrow();
    expect(() => withPrivateSWR(5, -1)).toThrow();
  });

  it("never emits the 'public' directive", () => {
    const header = withPrivateSWR(60, 600);
    expect(header).not.toMatch(/\bpublic\b/);
    expect(header).toMatch(/\bprivate\b/);
  });
});

describe("isPrivateCacheHeader", () => {
  it("treats withPrivateSWR output as private", () => {
    expect(isPrivateCacheHeader(withPrivateSWR(5, 30))).toBe(true);
  });

  it("treats no-store as private (never cached anywhere)", () => {
    expect(isPrivateCacheHeader(NO_STORE)).toBe(true);
  });

  it("rejects headers that include public", () => {
    expect(isPrivateCacheHeader("public, max-age=60")).toBe(false);
    expect(isPrivateCacheHeader("private, public")).toBe(false);
  });

  it("rejects headers that omit private", () => {
    expect(isPrivateCacheHeader("max-age=60")).toBe(false);
  });

  it("is case-insensitive on directives", () => {
    expect(isPrivateCacheHeader("PRIVATE, max-age=5")).toBe(true);
    expect(isPrivateCacheHeader("Public, max-age=5")).toBe(false);
  });
});
