import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import {
  localSignedUrl,
  localStoragePath,
  signLocalToken,
  verifyLocalToken,
} from "@/lib/storage/local-fs-storage";

const TEST_SECRET = "test-secret-for-vitest";

describe("localStoragePath", () => {
  it("resolves <cwd>/.storage/comprobantes/<key>", () => {
    const path = localStoragePath("user123/rec456.pdf");
    expect(path).toBe(resolve(process.cwd(), ".storage/comprobantes/user123/rec456.pdf"));
  });

  it("absolute path always lives inside .storage/comprobantes", () => {
    const path = localStoragePath("a/b/c.bin");
    expect(path.includes("/.storage/comprobantes/")).toBe(true);
  });
});

describe("signLocalToken", () => {
  it("is deterministic for the same inputs", () => {
    const t1 = signLocalToken("u/r.pdf", 1000, TEST_SECRET);
    const t2 = signLocalToken("u/r.pdf", 1000, TEST_SECRET);
    expect(t1).toBe(t2);
  });

  it("is sensitive to the key", () => {
    const t1 = signLocalToken("u/r.pdf", 1000, TEST_SECRET);
    const t2 = signLocalToken("u/different.pdf", 1000, TEST_SECRET);
    expect(t1).not.toBe(t2);
  });

  it("is sensitive to the expiry", () => {
    const t1 = signLocalToken("u/r.pdf", 1000, TEST_SECRET);
    const t2 = signLocalToken("u/r.pdf", 1001, TEST_SECRET);
    expect(t1).not.toBe(t2);
  });

  it("is sensitive to the secret", () => {
    const t1 = signLocalToken("u/r.pdf", 1000, "secret-a");
    const t2 = signLocalToken("u/r.pdf", 1000, "secret-b");
    expect(t1).not.toBe(t2);
  });

  it("returns 64-char hex (sha256)", () => {
    const token = signLocalToken("u/r.pdf", 1000, TEST_SECRET);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("verifyLocalToken", () => {
  it("accepts a valid, unexpired token", () => {
    const expires = Math.floor(Date.now() / 1000) + 60;
    const token = signLocalToken("u/r.pdf", expires, TEST_SECRET);
    expect(verifyLocalToken("u/r.pdf", expires, token, TEST_SECRET)).toBe(true);
  });

  it("rejects an expired token", () => {
    const expires = Math.floor(Date.now() / 1000) - 1;
    const token = signLocalToken("u/r.pdf", expires, TEST_SECRET);
    expect(verifyLocalToken("u/r.pdf", expires, token, TEST_SECRET)).toBe(false);
  });

  it("rejects a token signed for a different key", () => {
    const expires = Math.floor(Date.now() / 1000) + 60;
    const token = signLocalToken("u/r.pdf", expires, TEST_SECRET);
    expect(verifyLocalToken("u/forged.pdf", expires, token, TEST_SECRET)).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const expires = Math.floor(Date.now() / 1000) + 60;
    const token = signLocalToken("u/r.pdf", expires, "real-secret");
    expect(verifyLocalToken("u/r.pdf", expires, token, "wrong-secret")).toBe(false);
  });

  it("rejects a forged token of the right length (constant-time compare)", () => {
    const expires = Math.floor(Date.now() / 1000) + 60;
    const forged = "a".repeat(64);
    expect(verifyLocalToken("u/r.pdf", expires, forged, TEST_SECRET)).toBe(false);
  });

  it("rejects tokens of the wrong length without throwing", () => {
    const expires = Math.floor(Date.now() / 1000) + 60;
    expect(verifyLocalToken("u/r.pdf", expires, "short", TEST_SECRET)).toBe(false);
    expect(verifyLocalToken("u/r.pdf", expires, "a".repeat(128), TEST_SECRET)).toBe(false);
  });

  it("rejects non-finite expires", () => {
    expect(verifyLocalToken("u/r.pdf", NaN, "a".repeat(64), TEST_SECRET)).toBe(false);
    expect(verifyLocalToken("u/r.pdf", Infinity, "a".repeat(64), TEST_SECRET)).toBe(false);
  });

  it("rejects non-hex tokens of correct length", () => {
    const expires = Math.floor(Date.now() / 1000) + 60;
    // 64 chars but not valid hex
    expect(verifyLocalToken("u/r.pdf", expires, "z".repeat(64), TEST_SECRET)).toBe(false);
  });
});

describe("localSignedUrl", () => {
  const ORIGINAL_NEXTAUTH_URL = process.env.NEXTAUTH_URL;
  const ORIGINAL_NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

  function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
    const old: Record<string, string | undefined> = {};
    for (const k of Object.keys(env)) {
      old[k] = process.env[k];
      if (env[k] === undefined) delete process.env[k];
      else process.env[k] = env[k];
    }
    try {
      return fn();
    } finally {
      for (const k of Object.keys(old)) {
        if (old[k] === undefined) delete process.env[k];
        else process.env[k] = old[k];
      }
    }
  }

  it("uses NEXTAUTH_URL as the base", () => {
    const url = withEnv(
      { NEXTAUTH_URL: "http://localhost:3000", NEXTAUTH_SECRET: TEST_SECRET },
      () => localSignedUrl("u/r.pdf", 60),
    );
    expect(url.startsWith("http://localhost:3000/api/storage/u/r.pdf?")).toBe(true);
  });

  it("falls back to http://localhost:3000 when NEXTAUTH_URL is unset", () => {
    const url = withEnv({ NEXTAUTH_URL: undefined, NEXTAUTH_SECRET: TEST_SECRET }, () =>
      localSignedUrl("u/r.pdf", 60),
    );
    expect(url.startsWith("http://localhost:3000/api/storage/u/r.pdf?")).toBe(true);
  });

  it("includes token and expires query params", () => {
    const url = withEnv(
      { NEXTAUTH_URL: "http://localhost:3000", NEXTAUTH_SECRET: TEST_SECRET },
      () => localSignedUrl("u/r.pdf", 60),
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get("token")).toMatch(/^[0-9a-f]{64}$/);
    expect(Number(parsed.searchParams.get("expires"))).toBeGreaterThan(
      Math.floor(Date.now() / 1000),
    );
  });

  it("expires roughly ttlSec seconds in the future", () => {
    const url = withEnv(
      { NEXTAUTH_URL: "http://localhost:3000", NEXTAUTH_SECRET: TEST_SECRET },
      () => localSignedUrl("u/r.pdf", 120),
    );
    const expires = Number(new URL(url).searchParams.get("expires"));
    const now = Math.floor(Date.now() / 1000);
    expect(expires - now).toBeGreaterThanOrEqual(118);
    expect(expires - now).toBeLessThanOrEqual(122);
  });

  it("URL-encodes each segment of the key", () => {
    const url = withEnv(
      { NEXTAUTH_URL: "http://localhost:3000", NEXTAUTH_SECRET: TEST_SECRET },
      () => localSignedUrl("user with space/r.pdf", 60),
    );
    expect(url).toContain("/api/storage/user%20with%20space/r.pdf?");
  });

  it("token in the URL verifies against the same key + expires", () => {
    const url = withEnv(
      { NEXTAUTH_URL: "http://localhost:3000", NEXTAUTH_SECRET: TEST_SECRET },
      () => localSignedUrl("u/r.pdf", 60),
    );
    const parsed = new URL(url);
    const token = parsed.searchParams.get("token")!;
    const expires = Number(parsed.searchParams.get("expires"));
    expect(verifyLocalToken("u/r.pdf", expires, token, TEST_SECRET)).toBe(true);
  });

  // Sanity: confirm no leakage between cases
  it("restores original env after test runs", () => {
    expect(process.env.NEXTAUTH_URL).toBe(ORIGINAL_NEXTAUTH_URL);
    expect(process.env.NEXTAUTH_SECRET).toBe(ORIGINAL_NEXTAUTH_SECRET);
  });
});
