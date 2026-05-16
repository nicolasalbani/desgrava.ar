import { describe, expect, it } from "vitest";
import { looksLikeAutomationReport } from "@/lib/soporte/looks-like-automation-report";
import type { ChatMessage } from "@/lib/soporte/types";

describe("looksLikeAutomationReport", () => {
  it("returns true when the description mentions SiRADIG", () => {
    expect(looksLikeAutomationReport([], "error al enviar la factura a SiRADIG")).toBe(true);
  });

  it("returns true when the conversation mentions a deduction", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "tengo un problema con la deducción de Diana" },
      { role: "assistant", content: "claro, contame más" },
    ];
    expect(looksLikeAutomationReport(messages, "no anda")).toBe(true);
  });

  it("matches across language variants (with/without accents)", () => {
    expect(looksLikeAutomationReport([], "presentacion fallida")).toBe(true);
    expect(looksLikeAutomationReport([], "presentación fallida")).toBe(true);
  });

  it("returns false for a generic non-automation report", () => {
    expect(
      looksLikeAutomationReport(
        [{ role: "user", content: "el botón de login no funciona" }],
        "no puedo loguearme con Google",
      ),
    ).toBe(false);
  });

  it("returns false for an empty conversation and empty description", () => {
    expect(looksLikeAutomationReport([], "")).toBe(false);
  });
});
