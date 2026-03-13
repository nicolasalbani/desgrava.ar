import { describe, it, expect } from "vitest";
import {
  getSiradigCategoryText,
  getSiradigInvoiceTypeText,
  getSiradigCategoryLinkId,
  getAlquilerLinkId,
  isAlquilerCategory,
  isEducationCategory,
  isIndumentariaTrabajoCategory,
  isSchoolProvider,
  SIRADIG_CATEGORY_MAP,
  SIRADIG_INVOICE_TYPE_MAP,
  SIRADIG_CATEGORY_LINK_MAP,
} from "@/lib/automation/deduction-mapper";

describe("getSiradigCategoryText", () => {
  it.each(Object.entries(SIRADIG_CATEGORY_MAP))("maps %s to '%s'", (key, expected) => {
    expect(getSiradigCategoryText(key)).toBe(expected);
  });

  it("returns the input string as fallback for unknown categories", () => {
    expect(getSiradigCategoryText("UNKNOWN_CATEGORY")).toBe("UNKNOWN_CATEGORY");
    expect(getSiradigCategoryText("")).toBe("");
  });
});

describe("getSiradigInvoiceTypeText", () => {
  it.each(Object.entries(SIRADIG_INVOICE_TYPE_MAP))("maps %s to '%s'", (key, expected) => {
    expect(getSiradigInvoiceTypeText(key)).toBe(expected);
  });

  it("returns the input string as fallback for unknown invoice types", () => {
    expect(getSiradigInvoiceTypeText("FACTURA_Z")).toBe("FACTURA_Z");
    expect(getSiradigInvoiceTypeText("")).toBe("");
  });
});

describe("getSiradigCategoryLinkId", () => {
  it.each(Object.entries(SIRADIG_CATEGORY_LINK_MAP))("maps %s to '%s'", (key, expected) => {
    expect(getSiradigCategoryLinkId(key)).toBe(expected);
  });

  it("returns undefined for unknown categories", () => {
    expect(getSiradigCategoryLinkId("UNKNOWN_CATEGORY")).toBeUndefined();
    expect(getSiradigCategoryLinkId("")).toBeUndefined();
  });

  it("maps all categories that exist in SIRADIG_CATEGORY_MAP", () => {
    for (const key of Object.keys(SIRADIG_CATEGORY_MAP)) {
      expect(getSiradigCategoryLinkId(key)).toBeDefined();
    }
  });
});

describe("getAlquilerLinkId", () => {
  it("returns inq_n link when ownsProperty is true", () => {
    expect(getAlquilerLinkId(true)).toBe("link_agregar_alquiler_inmuebles_inq_n");
  });

  it("returns inq_o link when ownsProperty is false", () => {
    expect(getAlquilerLinkId(false)).toBe("link_agregar_alquiler_inmuebles_inq_o");
  });

  it("both returned link IDs are recognized as alquiler categories", () => {
    expect(isAlquilerCategory(getAlquilerLinkId(true))).toBe(true);
    expect(isAlquilerCategory(getAlquilerLinkId(false))).toBe(true);
  });
});

describe("isAlquilerCategory", () => {
  it("returns true for all alquiler link IDs", () => {
    expect(isAlquilerCategory("link_agregar_alquiler_inmuebles_inq_n")).toBe(true);
    expect(isAlquilerCategory("link_agregar_alquiler_inmuebles_inq_o")).toBe(true);
    expect(isAlquilerCategory("link_agregar_alquiler_inmuebles_prop")).toBe(true);
  });

  it("returns false for non-alquiler link IDs", () => {
    expect(isAlquilerCategory("link_agregar_donaciones")).toBe(false);
    expect(isAlquilerCategory("link_agregar_gastos_medicos")).toBe(false);
    expect(isAlquilerCategory("")).toBe(false);
  });
});

describe("isEducationCategory", () => {
  it("returns true for GASTOS_EDUCATIVOS", () => {
    expect(isEducationCategory("GASTOS_EDUCATIVOS")).toBe(true);
  });

  it("returns false for other categories", () => {
    expect(isEducationCategory("DONACIONES")).toBe(false);
    expect(isEducationCategory("GASTOS_MEDICOS")).toBe(false);
    expect(isEducationCategory("")).toBe(false);
  });
});

describe("isIndumentariaTrabajoCategory", () => {
  it("returns true for GASTOS_INDUMENTARIA_TRABAJO", () => {
    expect(isIndumentariaTrabajoCategory("GASTOS_INDUMENTARIA_TRABAJO")).toBe(true);
  });

  it("returns false for other categories", () => {
    expect(isIndumentariaTrabajoCategory("GASTOS_EDUCATIVOS")).toBe(false);
    expect(isIndumentariaTrabajoCategory("")).toBe(false);
  });
});

describe("isSchoolProvider", () => {
  it.each([
    ["Escuela Primaria N42", "escuela"],
    ["Colegio San Martin", "colegio"],
    ["Universidad de Buenos Aires", "universidad"],
    ["Instituto Tecnológico", "instituto"],
    ["Jardín de Infantes Arcoíris", "jardín with accent"],
    ["Jardin Municipal", "jardin without accent"],
    ["Liceo Nacional", "liceo"],
    ["Academia de Lenguas", "academia"],
    ["Centro de Educación Superior", "educaci partial match"],
    ["Kindergarten Los Pinos", "kindergarten"],
    ["Buenos Aires College", "college"],
    ["Facultad de Ingeniería", "facultad"],
    ["Fundación Escuelas del Sur", "fundación escuelas"],
    ["My School of English", "school"],
  ])("returns true for '%s' (keyword: %s)", (name) => {
    expect(isSchoolProvider(name)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isSchoolProvider("ESCUELA PRIMARIA")).toBe(true);
    expect(isSchoolProvider("UNIVERSIDAD NACIONAL")).toBe(true);
    expect(isSchoolProvider("colegio privado")).toBe(true);
  });

  it.each([
    "Librería El Ateneo",
    "Supermercado Carrefour",
    "Farmacia del Pueblo",
    "OSDE",
    "Swiss Medical",
    "Consultorio Médico",
    "",
  ])("returns false for non-school provider '%s'", (name) => {
    expect(isSchoolProvider(name)).toBe(false);
  });
});

describe("data integrity", () => {
  it("all three maps have the same set of category keys", () => {
    const categoryKeys = Object.keys(SIRADIG_CATEGORY_MAP).sort();
    const linkKeys = Object.keys(SIRADIG_CATEGORY_LINK_MAP).sort();
    expect(categoryKeys).toEqual(linkKeys);
  });

  it("all category map values are non-empty strings", () => {
    for (const [key, value] of Object.entries(SIRADIG_CATEGORY_MAP)) {
      expect(value, `${key} should have a non-empty value`).toBeTruthy();
      expect(typeof value).toBe("string");
    }
  });

  it("all invoice type map values are non-empty strings", () => {
    for (const [key, value] of Object.entries(SIRADIG_INVOICE_TYPE_MAP)) {
      expect(value, `${key} should have a non-empty value`).toBeTruthy();
      expect(typeof value).toBe("string");
    }
  });

  it("all link map values are non-empty strings starting with 'link_'", () => {
    for (const [key, value] of Object.entries(SIRADIG_CATEGORY_LINK_MAP)) {
      expect(value, `${key} should start with 'link_'`).toMatch(/^link_/);
    }
  });
});
