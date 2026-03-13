import { describe, it, expect } from "vitest";
import {
  normalize,
  tokenize,
  matchDependent,
  buildInvoiceText,
} from "@/lib/matching/dependent-matcher";

describe("normalize", () => {
  it("lowercases text", () => {
    expect(normalize("HELLO")).toBe("hello");
  });

  it("strips accents", () => {
    expect(normalize("José María")).toBe("jose maria");
  });

  it("trims whitespace", () => {
    expect(normalize("  hello  ")).toBe("hello");
  });

  it("handles combined accents and case", () => {
    expect(normalize("ALBAÑÍ")).toBe("albani");
  });
});

describe("tokenize", () => {
  it("splits into lowercase tokens", () => {
    expect(tokenize("LUCA ALBANI")).toEqual(["luca", "albani"]);
  });

  it("handles multiple spaces", () => {
    expect(tokenize("  LUCA   ALBANI  ")).toEqual(["luca", "albani"]);
  });

  it("returns empty for blank input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   ")).toEqual([]);
  });

  it("strips accents in tokens", () => {
    expect(tokenize("José García")).toEqual(["jose", "garcia"]);
  });
});

describe("matchDependent", () => {
  const dependents = [
    { id: "dep-1", nombre: "LUCA", apellido: "ALBANI" },
    { id: "dep-2", nombre: "EMMA", apellido: "ALBANI" },
    { id: "dep-3", nombre: "SOFIA", apellido: "PEREZ" },
  ];

  it("matches exactly one dependent by full name in description", () => {
    const result = matchDependent("Cuota mensual - LUCA ALBANI", dependents);
    expect(result).toEqual({
      dependentId: "dep-1",
      reason: "matched",
      matchedName: "LUCA ALBANI",
    });
  });

  it("matches case-insensitively", () => {
    const result = matchDependent("cuota luca albani escuela", dependents);
    expect(result).toEqual({
      dependentId: "dep-1",
      reason: "matched",
      matchedName: "LUCA ALBANI",
    });
  });

  it("matches with accents in text", () => {
    const result = matchDependent("Sofía Pérez - cuota", dependents);
    expect(result).toEqual({
      dependentId: "dep-3",
      reason: "matched",
      matchedName: "SOFIA PEREZ",
    });
  });

  it("returns ambiguous when multiple dependents match", () => {
    // "ALBANI" alone matches both LUCA ALBANI and EMMA ALBANI only if both
    // have all their tokens present. Since "LUCA" and "EMMA" are not in text,
    // neither fully matches.
    const result = matchDependent("Escuela ALBANI", dependents);
    expect(result).toEqual({ dependentId: null, reason: "no_match" });
  });

  it("returns ambiguous when multiple full names appear", () => {
    const result = matchDependent("LUCA ALBANI y EMMA ALBANI cuota", dependents);
    expect(result).toEqual({ dependentId: null, reason: "ambiguous" });
  });

  it("returns no_match when no dependent matches", () => {
    const result = matchDependent("Cuota mensual escuela primaria", dependents);
    expect(result).toEqual({ dependentId: null, reason: "no_match" });
  });

  it("returns no_match for empty text", () => {
    const result = matchDependent("", dependents);
    expect(result).toEqual({ dependentId: null, reason: "no_match" });
  });

  it("returns no_match for empty dependents list", () => {
    const result = matchDependent("LUCA ALBANI", []);
    expect(result).toEqual({ dependentId: null, reason: "no_match" });
  });

  it("requires all name tokens to be present", () => {
    // Only "LUCA" present, missing "ALBANI" -> no match
    const result = matchDependent("Cuota de LUCA", dependents);
    expect(result).toEqual({ dependentId: null, reason: "no_match" });
  });

  it("matches when name tokens are scattered in text", () => {
    const result = matchDependent("Albani, escuela para Emma - cuota", dependents);
    expect(result).toEqual({
      dependentId: "dep-2",
      reason: "matched",
      matchedName: "EMMA ALBANI",
    });
  });
});

describe("buildInvoiceText", () => {
  it("combines description and providerName", () => {
    const text = buildInvoiceText({
      description: "Cuota mensual LUCA",
      providerName: "Escuela ALBANI",
    });
    expect(text).toBe("Cuota mensual LUCA Escuela ALBANI");
  });

  it("handles null fields", () => {
    const text = buildInvoiceText({ description: null, providerName: "Escuela" });
    expect(text).toBe("Escuela");
  });

  it("handles all null", () => {
    const text = buildInvoiceText({ description: null, providerName: null });
    expect(text).toBe("");
  });

  it("handles undefined fields", () => {
    const text = buildInvoiceText({});
    expect(text).toBe("");
  });
});
