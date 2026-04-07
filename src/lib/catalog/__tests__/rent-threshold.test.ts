import { describe, it, expect, vi, beforeEach } from "vitest";
import { RENT_AMOUNT_THRESHOLD } from "@/lib/catalog/provider-catalog";

// Mock prisma before importing the module under test
vi.mock("@/lib/prisma", () => ({
  prisma: {
    providerCatalog: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

// Mock the classifier — we control what it returns
const classifyCategoryMock = vi.fn();
const classifyCategoryByKeywordsMock = vi.fn();

vi.mock("@/lib/ocr/category-classifier", () => ({
  classifyCategory: (...args: unknown[]) => classifyCategoryMock(...args),
  classifyCategoryByKeywords: (...args: unknown[]) => classifyCategoryByKeywordsMock(...args),
}));

import { resolveCategory } from "@/lib/catalog/provider-catalog";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RENT_AMOUNT_THRESHOLD constant", () => {
  it("is 100_000", () => {
    expect(RENT_AMOUNT_THRESHOLD).toBe(100_000);
  });
});

describe("resolveCategory — rent amount threshold", () => {
  it("accepts ALQUILER_VIVIENDA when amount is above threshold", async () => {
    classifyCategoryMock.mockResolvedValue("ALQUILER_VIVIENDA");

    const result = await resolveCategory({
      cuit: "20123456789",
      providerName: "Alquileres SA",
      amount: 150_000,
      pdfText: "Alquiler departamento mayo 2026",
    });

    expect(result).toBe("ALQUILER_VIVIENDA");
    // Should only call classify once (no re-classification)
    expect(classifyCategoryMock).toHaveBeenCalledTimes(1);
  });

  it("accepts ALQUILER_VIVIENDA when amount equals threshold", async () => {
    classifyCategoryMock.mockResolvedValue("ALQUILER_VIVIENDA");

    const result = await resolveCategory({
      cuit: "20123456789",
      providerName: "Inmobiliaria Test",
      amount: 100_000,
      pdfText: "Alquiler mensual vivienda",
    });

    expect(result).toBe("ALQUILER_VIVIENDA");
    expect(classifyCategoryMock).toHaveBeenCalledTimes(1);
  });

  it("re-classifies when ALQUILER_VIVIENDA and amount is below threshold", async () => {
    // First call returns rent, second call (with exclusion) returns something else
    classifyCategoryMock
      .mockResolvedValueOnce("ALQUILER_VIVIENDA")
      .mockResolvedValueOnce("GASTOS_INDUMENTARIA_TRABAJO");

    const result = await resolveCategory({
      cuit: "20123456789",
      providerName: "Alquiler de trajes SRL",
      amount: 50_000,
      pdfText: "Servicio de alquiler de indumentaria",
    });

    expect(result).toBe("GASTOS_INDUMENTARIA_TRABAJO");
    // Called twice: original + re-classification
    expect(classifyCategoryMock).toHaveBeenCalledTimes(2);
    // Second call should exclude ALQUILER_VIVIENDA
    expect(classifyCategoryMock).toHaveBeenLastCalledWith(expect.any(String), [
      "ALQUILER_VIVIENDA",
    ]);
  });

  it("falls back to NO_DEDUCIBLE when re-classification finds nothing deductible", async () => {
    classifyCategoryMock
      .mockResolvedValueOnce("ALQUILER_VIVIENDA")
      .mockResolvedValueOnce("NO_DEDUCIBLE");

    const result = await resolveCategory({
      cuit: "20123456789",
      providerName: "Alquiler de inflables",
      amount: 15_000,
      pdfText: "Alquiler castillo inflable cumpleaños",
    });

    expect(result).toBe("NO_DEDUCIBLE");
    expect(classifyCategoryMock).toHaveBeenCalledTimes(2);
  });

  it("accepts ALQUILER_VIVIENDA when amount is undefined (skip threshold check)", async () => {
    classifyCategoryMock.mockResolvedValue("ALQUILER_VIVIENDA");

    const result = await resolveCategory({
      cuit: "20123456789",
      providerName: "Inmobiliaria Test",
      pdfText: "Alquiler departamento",
    });

    expect(result).toBe("ALQUILER_VIVIENDA");
    expect(classifyCategoryMock).toHaveBeenCalledTimes(1);
  });

  it("does not re-classify non-rent categories below threshold", async () => {
    classifyCategoryMock.mockResolvedValue("GASTOS_MEDICOS");

    const result = await resolveCategory({
      cuit: "20123456789",
      providerName: "Consultorio Dr. Perez",
      amount: 5_000,
      pdfText: "Consulta médica general",
    });

    expect(result).toBe("GASTOS_MEDICOS");
    expect(classifyCategoryMock).toHaveBeenCalledTimes(1);
  });

  it("re-classifies via web lookup path when amount is below threshold", async () => {
    // No pdfText → falls to web lookup → no web result → fallback metadata classification
    classifyCategoryMock
      .mockResolvedValueOnce("ALQUILER_VIVIENDA")
      .mockResolvedValueOnce("NO_DEDUCIBLE");

    const result = await resolveCategory({
      cuit: "20123456789",
      providerName: "Alquiler de autos SRL",
      amount: 30_000,
    });

    expect(result).toBe("NO_DEDUCIBLE");
    expect(classifyCategoryMock).toHaveBeenCalledTimes(2);
    expect(classifyCategoryMock).toHaveBeenLastCalledWith(expect.any(String), [
      "ALQUILER_VIVIENDA",
    ]);
  });
});
