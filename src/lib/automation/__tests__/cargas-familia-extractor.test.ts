import { describe, it, expect } from "vitest";
import { mapSiradigTipoDoc, filterValidDependents } from "@/lib/automation/siradig-navigator";
import type { SiradigFamilyDependent } from "@/lib/automation/siradig-navigator";
import { ARCA_SELECTORS } from "@/lib/automation/selectors";

describe("mapSiradigTipoDoc", () => {
  it.each([
    ["80", "CUIT"],
    ["86", "CUIL"],
    ["87", "CDI"],
    ["96", "DNI"],
    ["89", "LC"],
    ["90", "LE"],
  ])("maps SiRADIG code %s to %s", (code, expected) => {
    expect(mapSiradigTipoDoc(code)).toBe(expected);
  });

  it("returns the original value for unknown codes", () => {
    expect(mapSiradigTipoDoc("99")).toBe("99");
    expect(mapSiradigTipoDoc("")).toBe("");
    expect(mapSiradigTipoDoc("UNKNOWN")).toBe("UNKNOWN");
  });

  it("covers all document types used in FamilyDependent model", () => {
    const expectedTypes = ["CUIT", "CUIL", "CDI", "DNI", "LC", "LE"];
    const mappedTypes = ["80", "86", "87", "96", "89", "90"].map(mapSiradigTipoDoc);
    expect(mappedTypes).toEqual(expectedTypes);
  });
});

describe("cargasFamilia selectors", () => {
  const sel = ARCA_SELECTORS.siradig.cargasFamilia;

  it("contains all required selectors", () => {
    expect(sel.accordionTab).toBeDefined();
    expect(sel.sectionContainer).toBeDefined();
    expect(sel.tableContainer).toBeDefined();
    expect(sel.table).toBeDefined();
    expect(sel.tableRows).toBeDefined();
    expect(sel.editButton).toBeDefined();
  });

  it("contains all form field selectors", () => {
    expect(sel.formTipoDoc).toBeDefined();
    expect(sel.formNumeroDoc).toBeDefined();
    expect(sel.formApellido).toBeDefined();
    expect(sel.formNombre).toBeDefined();
    expect(sel.formFechaNacimiento).toBeDefined();
    expect(sel.formParentesco).toBeDefined();
    expect(sel.formFechaCasamiento).toBeDefined();
    expect(sel.formPorcentajeDed).toBeDefined();
    expect(sel.formCuitOtroDed).toBeDefined();
    expect(sel.formFamiliaCargo).toBeDefined();
    expect(sel.formResidente).toBeDefined();
    expect(sel.formIngresos).toBeDefined();
    expect(sel.formMontoIngresos).toBeDefined();
    expect(sel.formMesDesde).toBeDefined();
    expect(sel.formMesHasta).toBeDefined();
    expect(sel.formProximosPeriodos).toBeDefined();
    expect(sel.formVolverBtn).toBeDefined();
  });

  it("all selectors are non-empty strings", () => {
    for (const [key, value] of Object.entries(sel)) {
      expect(typeof value, `cargasFamilia.${key} should be a string`).toBe("string");
      expect(value.length, `cargasFamilia.${key} should be non-empty`).toBeGreaterThan(0);
    }
  });

  it("table selector references correct SiRADIG element ID", () => {
    expect(sel.table).toBe("#nueva_tabla_cargas_familia");
  });

  it("table rows selector is derived from the table selector", () => {
    expect(sel.tableRows).toContain("nueva_tabla_cargas_familia");
    expect(sel.tableRows).toContain("tbody tr");
  });

  it("form field selectors start with #", () => {
    const formFields = Object.entries(sel).filter(([key]) => key.startsWith("form"));
    for (const [key, value] of formFields) {
      expect(value, `${key} should start with #`).toMatch(/^#/);
    }
  });
});

describe("filterValidDependents", () => {
  const validDependent: SiradigFamilyDependent = {
    tipoDoc: "CUIL",
    numeroDoc: "20594910991",
    apellido: "ALBANI SETTI",
    nombre: "LUCA",
    fechaNacimiento: "01/01/2020",
    parentesco: "3",
    fechaUnion: "",
    porcentajeDed: "100",
    cuitOtroDed: "",
    familiaCargo: true,
    residente: true,
    tieneIngresos: false,
    montoIngresos: "",
    mesDesde: 1,
    mesHasta: 12,
    proximosPeriodos: true,
  };

  const phantomDependent: SiradigFamilyDependent = {
    ...validDependent,
    tipoDoc: "",
    numeroDoc: "",
    apellido: "",
    nombre: "",
    fechaNacimiento: "",
    parentesco: "",
  };

  it("keeps valid dependents with a document number", () => {
    const result = filterValidDependents([validDependent]);
    expect(result).toHaveLength(1);
    expect(result[0].numeroDoc).toBe("20594910991");
  });

  it("removes phantom rows with empty numeroDoc", () => {
    const result = filterValidDependents([validDependent, phantomDependent]);
    expect(result).toHaveLength(1);
  });

  it("removes rows with whitespace-only numeroDoc", () => {
    const whitespaceDependent = { ...phantomDependent, numeroDoc: "   " };
    const result = filterValidDependents([validDependent, whitespaceDependent]);
    expect(result).toHaveLength(1);
  });

  it("returns empty array when all entries are phantom", () => {
    const result = filterValidDependents([phantomDependent]);
    expect(result).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    const result = filterValidDependents([]);
    expect(result).toHaveLength(0);
  });
});
