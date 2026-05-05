import { describe, it, expect } from "vitest";
import { shouldGenerateTitle } from "@/lib/soporte/conversation-title";

describe("shouldGenerateTitle", () => {
  it("returns false when fewer than 4 messages exist", () => {
    expect(shouldGenerateTitle(0, null)).toBe(false);
    expect(shouldGenerateTitle(1, null)).toBe(false);
    expect(shouldGenerateTitle(2, null)).toBe(false);
    expect(shouldGenerateTitle(3, null)).toBe(false);
  });

  it("returns true at exactly 4 messages with no title", () => {
    expect(shouldGenerateTitle(4, null)).toBe(true);
  });

  it("returns true past 4 messages with no title (retry path)", () => {
    expect(shouldGenerateTitle(5, null)).toBe(true);
    expect(shouldGenerateTitle(20, null)).toBe(true);
  });

  it("returns false when a title already exists, regardless of message count", () => {
    expect(shouldGenerateTitle(4, "Problema con ARCA")).toBe(false);
    expect(shouldGenerateTitle(50, "Cualquier título")).toBe(false);
  });

  it("treats empty string as a set title (not regenerated)", () => {
    // shouldGenerateTitle gates on `=== null`, so an empty-string title is considered set
    expect(shouldGenerateTitle(4, "")).toBe(false);
  });
});
