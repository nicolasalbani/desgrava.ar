import { describe, it, expect } from "vitest";
import { buildManifest, parseSignatureHeader } from "@/app/api/webhooks/mercadopago/route";

describe("parseSignatureHeader", () => {
  it("parses ts and v1 from a well-formed header", () => {
    const result = parseSignatureHeader("ts=1700000000,v1=abc123");
    expect(result).toEqual({ ts: "1700000000", v1: "abc123" });
  });

  it("tolerates whitespace between parts", () => {
    const result = parseSignatureHeader("ts=1700000000, v1=abc123");
    expect(result).toEqual({ ts: "1700000000", v1: "abc123" });
  });

  it("returns null when header is missing", () => {
    expect(parseSignatureHeader(null)).toBeNull();
  });

  it("returns null when v1 is missing", () => {
    expect(parseSignatureHeader("ts=1700000000")).toBeNull();
  });

  it("returns null when ts is missing", () => {
    expect(parseSignatureHeader("v1=abc123")).toBeNull();
  });
});

describe("buildManifest", () => {
  it("matches MercadoPago's documented signature template", () => {
    const manifest = buildManifest("7028180992", "req-abc", "1700000000");
    expect(manifest).toBe("id:7028180992;request-id:req-abc;ts:1700000000;");
  });

  it("uses an empty string when request-id is absent", () => {
    const manifest = buildManifest("123", "", "1700000000");
    expect(manifest).toBe("id:123;request-id:;ts:1700000000;");
  });
});
