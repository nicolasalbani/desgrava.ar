import { describe, it, expect } from "vitest";
import { invoiceDedupeKey, shouldSoftDelete } from "@/lib/invoices/dedupe";

describe("invoiceDedupeKey", () => {
  it("builds a key from cuit, invoice number, and fiscal year", () => {
    expect(invoiceDedupeKey("20123456789", "00005-00001234", 2025)).toBe(
      "20123456789|00005-00001234|2025",
    );
  });

  it("treats null invoiceNumber as empty string", () => {
    expect(invoiceDedupeKey("20123456789", null, 2025)).toBe("20123456789||2025");
  });

  it("produces distinct keys for different cuits", () => {
    const a = invoiceDedupeKey("20123456789", "00005-00001234", 2025);
    const b = invoiceDedupeKey("27987654321", "00005-00001234", 2025);
    expect(a).not.toBe(b);
  });

  it("produces distinct keys for different fiscal years", () => {
    const a = invoiceDedupeKey("20123456789", "00005-00001234", 2025);
    const b = invoiceDedupeKey("20123456789", "00005-00001234", 2024);
    expect(a).not.toBe(b);
  });

  it("produces distinct keys for different invoice numbers", () => {
    const a = invoiceDedupeKey("20123456789", "00005-00001234", 2025);
    const b = invoiceDedupeKey("20123456789", "00005-00001235", 2025);
    expect(a).not.toBe(b);
  });

  it("produces stable keys (same inputs → same output)", () => {
    const a = invoiceDedupeKey("20123456789", "00005-00001234", 2025);
    const b = invoiceDedupeKey("20123456789", "00005-00001234", 2025);
    expect(a).toBe(b);
  });
});

describe("shouldSoftDelete", () => {
  it("returns true for ARCA-sourced rows", () => {
    expect(shouldSoftDelete("ARCA")).toBe(true);
  });

  it("returns false for MANUAL rows", () => {
    expect(shouldSoftDelete("MANUAL")).toBe(false);
  });

  it("returns false for PDF rows", () => {
    expect(shouldSoftDelete("PDF")).toBe(false);
  });

  it("returns false for OCR rows", () => {
    expect(shouldSoftDelete("OCR")).toBe(false);
  });

  it("returns false for EMAIL rows", () => {
    expect(shouldSoftDelete("EMAIL")).toBe(false);
  });
});
