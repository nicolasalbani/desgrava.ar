import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { classifyCategoryByKeywords } from "@/lib/ocr/category-classifier";
import { processDocument } from "@/lib/ocr/pipeline";

function fixture(name: string) {
  const p = path.join(__dirname, "fixtures", name);
  return { path: p, exists: existsSync(p) };
}

describe("classifyCategoryByKeywords", () => {
  it("returns ALQUILER_VIVIENDA when text contains 'alquiler'", () => {
    expect(classifyCategoryByKeywords("Concepto: alquiler mes de marzo")).toBe("ALQUILER_VIVIENDA");
  });

  it("matches 'alquiler' case-insensitively", () => {
    expect(classifyCategoryByKeywords("ALQUILER DE INMUEBLE")).toBe("ALQUILER_VIVIENDA");
    expect(classifyCategoryByKeywords("Alquiler departamento")).toBe("ALQUILER_VIVIENDA");
  });

  it("matches 'alquiler' as a whole word only", () => {
    expect(classifyCategoryByKeywords("subalquileres varios")).toBeNull();
  });

  it("returns null when no keyword matches", () => {
    expect(classifyCategoryByKeywords("Consulta médica general")).toBeNull();
    expect(classifyCategoryByKeywords("Cuota medicina prepaga")).toBeNull();
    expect(classifyCategoryByKeywords("")).toBeNull();
  });
});

// Integration test with the real PDF fixture
const alquilerPdf = fixture("arca-factura-b-alquiler.pdf");

describe.skipIf(!alquilerPdf.exists)(
  "classifyCategoryByKeywords — ARCA Factura B Alquiler (arca-factura-b-alquiler.pdf)",
  () => {
    it("classifies extracted PDF text as ALQUILER_VIVIENDA", async () => {
      const result = await processDocument(readFileSync(alquilerPdf.path), "application/pdf");
      expect(result.text).toBeTruthy();
      const category = classifyCategoryByKeywords(result.text);
      expect(category).toBe("ALQUILER_VIVIENDA");
    });
  },
);
