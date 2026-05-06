import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyCronAuth } from "@/lib/cron-auth";

function makeReq(headers: Record<string, string>) {
  const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    headers: {
      get: (key: string) => map.get(key.toLowerCase()) ?? null,
    },
  };
}

const ORIGINAL_SECRET = process.env.CRON_SECRET;

describe("verifyCronAuth", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret-xyz";
  });
  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_SECRET;
  });

  it("accepts a matching x-cron-secret header (GH Actions format)", () => {
    expect(verifyCronAuth(makeReq({ "x-cron-secret": "test-secret-xyz" }))).toBe(true);
  });

  it("accepts a matching Authorization: Bearer header (Vercel format)", () => {
    expect(verifyCronAuth(makeReq({ Authorization: "Bearer test-secret-xyz" }))).toBe(true);
  });

  it("rejects a wrong x-cron-secret value", () => {
    expect(verifyCronAuth(makeReq({ "x-cron-secret": "wrong" }))).toBe(false);
  });

  it("rejects a wrong Bearer token", () => {
    expect(verifyCronAuth(makeReq({ Authorization: "Bearer wrong" }))).toBe(false);
  });

  it("rejects when no auth headers are present", () => {
    expect(verifyCronAuth(makeReq({}))).toBe(false);
  });

  it("rejects an Authorization header without the Bearer prefix", () => {
    expect(verifyCronAuth(makeReq({ Authorization: "test-secret-xyz" }))).toBe(false);
  });

  it("rejects when CRON_SECRET is not configured", () => {
    delete process.env.CRON_SECRET;
    expect(verifyCronAuth(makeReq({ "x-cron-secret": "anything" }))).toBe(false);
    expect(verifyCronAuth(makeReq({ Authorization: "Bearer anything" }))).toBe(false);
  });

  it("matches header lookups case-insensitively (NextRequest convention)", () => {
    expect(verifyCronAuth(makeReq({ "X-Cron-Secret": "test-secret-xyz" }))).toBe(true);
    expect(verifyCronAuth(makeReq({ AUTHORIZATION: "Bearer test-secret-xyz" }))).toBe(true);
  });
});
