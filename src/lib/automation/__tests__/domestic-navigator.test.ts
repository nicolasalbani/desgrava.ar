import { describe, it, expect } from "vitest";
import { reasonToSkipReceiptRow } from "@/lib/automation/domestic-navigator";

describe("reasonToSkipReceiptRow", () => {
  describe("paid and generated (deductible)", () => {
    it("keeps fully-paid, receipted rows", () => {
      expect(reasonToSkipReceiptRow("CONSTANCIA DE PAGO", "VER RECIBO")).toBeNull();
    });

    it("is case-insensitive for deductible rows", () => {
      expect(reasonToSkipReceiptRow("Constancia de Pago", "Ver Recibo")).toBeNull();
    });

    it("tolerates surrounding whitespace", () => {
      expect(reasonToSkipReceiptRow("  CONSTANCIA DE PAGO  ", "  VER RECIBO  ")).toBeNull();
    });
  });

  describe("unpaid contribution", () => {
    it("skips rows whose Estado del pago is still PAGAR", () => {
      expect(reasonToSkipReceiptRow("PAGAR", "RECIBO")).toBe("sin pagar");
    });

    it("skips even if the receipt cell looks like VER RECIBO", () => {
      // Unlikely in practice, but we prefer the stricter check.
      expect(reasonToSkipReceiptRow("PAGAR", "VER RECIBO")).toBe("sin pagar");
    });

    it("matches PAGAR as a whole word, not inside larger text", () => {
      // Defensive: if ARCA ever embeds PAGAR as substring of an unrelated label,
      // only whole-word matches should be treated as the unpaid button.
      expect(reasonToSkipReceiptRow("CONSTANCIA DE PAGO anticipado", "VER RECIBO")).toBeNull();
    });
  });

  describe("receipt not generated", () => {
    it("skips rows whose Estado del recibo is still RECIBO", () => {
      expect(reasonToSkipReceiptRow("CONSTANCIA DE PAGO", "RECIBO")).toBe("sin recibo");
    });

    it("does NOT skip VER RECIBO as receipt-missing", () => {
      expect(reasonToSkipReceiptRow("CONSTANCIA DE PAGO", "VER RECIBO")).toBeNull();
    });
  });

  describe("priority between reasons", () => {
    it("reports 'sin pagar' before 'sin recibo' when both apply", () => {
      expect(reasonToSkipReceiptRow("PAGAR", "RECIBO")).toBe("sin pagar");
    });
  });

  // Inputs observed in live ARCA DOM. The "Estado del pago" cell holds either
  // a "Pagar" button (unpaid) or a "Constancia de pago" <input type=button>,
  // whose value is NOT part of textContent — so the value span reads as "".
  describe("real ARCA cell values", () => {
    it("unpaid: Pagar link", () => {
      expect(reasonToSkipReceiptRow("Pagar", "RECIBO")).toBe("sin pagar");
    });

    it("paid + receipt: input button (empty span) + VER RECIBO", () => {
      expect(reasonToSkipReceiptRow("", "VER RECIBO")).toBeNull();
    });

    it("paid but no receipt: input button (empty span) + RECIBO", () => {
      expect(reasonToSkipReceiptRow("", "RECIBO")).toBe("sin recibo");
    });
  });
});
