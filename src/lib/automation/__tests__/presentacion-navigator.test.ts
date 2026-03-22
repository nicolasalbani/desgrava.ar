import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { extractMontoTotalFromText } from "@/lib/automation/presentacion-navigator";

describe("extractMontoTotalFromText", () => {
  it("extracts monto from standard single-page format", () => {
    const text = "Deducciones y desgravaciones   $   17.378.002,61";
    expect(extractMontoTotalFromText(text)).toBe("17378002.61");
  });

  it("extracts monto when (continuación) is present (multi-page PDF)", () => {
    const text = "Deducciones y desgravaciones   $   (continuación) 17.378.002,61";
    expect(extractMontoTotalFromText(text)).toBe("17378002.61");
  });

  it("extracts monto with (continuacion) without accent", () => {
    const text = "Deducciones y desgravaciones   $   (continuacion) 1.234,56";
    expect(extractMontoTotalFromText(text)).toBe("1234.56");
  });

  it("extracts monto from real PDF fixture", async () => {
    // Use pdfjs-dist to extract text from the real fixture, same as the automation does
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdfPath = join(
      __dirname,
      "../../ocr/__tests__/fixtures/arca-presentacion-rectificativa.pdf",
    );
    const data = readFileSync(pdfPath);
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;

    let pdfText = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
       
      pdfText += (content.items as any[])
        .filter((item: { str?: string }) => "str" in item)
        .map((item: { str: string }) => item.str)
        .join(" ");
    }

    const result = extractMontoTotalFromText(pdfText);
    expect(result).toBe("17378002.61");
  });

  it("returns null when no match found", () => {
    const text = "Some random PDF text without the expected section";
    expect(extractMontoTotalFromText(text)).toBeNull();
  });

  it("handles small amounts correctly", () => {
    const text = "Deducciones y desgravaciones   $   500,00";
    expect(extractMontoTotalFromText(text)).toBe("500.00");
  });

  it("handles amounts with thousands separator", () => {
    const text = "Deducciones y desgravaciones   $   1.500,00";
    expect(extractMontoTotalFromText(text)).toBe("1500.00");
  });
});
