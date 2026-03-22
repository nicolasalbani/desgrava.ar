import { describe, it, expect } from "vitest";
import { ARCA_SELECTORS, SELECTOR_DESCRIPTIONS } from "@/lib/automation/selectors";

describe("ARCA_SELECTORS", () => {
  describe("login selectors", () => {
    it("contains all required login selectors", () => {
      expect(ARCA_SELECTORS.login.url).toBeDefined();
      expect(ARCA_SELECTORS.login.cuitInput).toBeDefined();
      expect(ARCA_SELECTORS.login.cuitSubmit).toBeDefined();
      expect(ARCA_SELECTORS.login.claveInput).toBeDefined();
      expect(ARCA_SELECTORS.login.loginSubmit).toBeDefined();
      expect(ARCA_SELECTORS.login.errorMessage).toBeDefined();
      expect(ARCA_SELECTORS.login.captchaContainer).toBeDefined();
    });

    it("all login selectors are non-empty strings", () => {
      for (const [key, value] of Object.entries(ARCA_SELECTORS.login)) {
        expect(typeof value, `login.${key} should be a string`).toBe("string");
        expect(value.length, `login.${key} should be non-empty`).toBeGreaterThan(0);
      }
    });

    it("login URL is a valid AFIP URL", () => {
      expect(ARCA_SELECTORS.login.url).toMatch(/^https:\/\/.*afip\.gob\.ar/);
    });
  });

  describe("portal selectors", () => {
    it("contains all required portal selectors", () => {
      expect(ARCA_SELECTORS.portal.servicesUrl).toBeDefined();
      expect(ARCA_SELECTORS.portal.siradigLink).toBeDefined();
      expect(ARCA_SELECTORS.portal.searchService).toBeDefined();
    });

    it("all portal selectors are non-empty strings", () => {
      for (const [key, value] of Object.entries(ARCA_SELECTORS.portal)) {
        expect(typeof value, `portal.${key} should be a string`).toBe("string");
        expect(value.length, `portal.${key} should be non-empty`).toBeGreaterThan(0);
      }
    });

    it("services URL is a valid AFIP URL", () => {
      expect(ARCA_SELECTORS.portal.servicesUrl).toMatch(/^https:\/\/.*afip\.gob\.ar/);
    });
  });

  describe("siradig selectors", () => {
    it("contains all required siradig selectors", () => {
      expect(ARCA_SELECTORS.siradig.baseUrl).toBeDefined();
      expect(ARCA_SELECTORS.siradig.cuitProviderInput).toBeDefined();
      expect(ARCA_SELECTORS.siradig.invoiceTypeSelect).toBeDefined();
      expect(ARCA_SELECTORS.siradig.amountInput).toBeDefined();
      expect(ARCA_SELECTORS.siradig.periodFromSelect).toBeDefined();
      expect(ARCA_SELECTORS.siradig.periodToSelect).toBeDefined();
      expect(ARCA_SELECTORS.siradig.saveButton).toBeDefined();
      expect(ARCA_SELECTORS.siradig.confirmButton).toBeDefined();
      expect(ARCA_SELECTORS.siradig.successMessage).toBeDefined();
      expect(ARCA_SELECTORS.siradig.errorContainer).toBeDefined();
    });

    it("all top-level siradig selectors are non-empty strings", () => {
      for (const [key, value] of Object.entries(ARCA_SELECTORS.siradig)) {
        if (typeof value === "string") {
          expect(value.length, `siradig.${key} should be non-empty`).toBeGreaterThan(0);
        } else {
          // nested selector group (e.g. cargasFamilia)
          expect(typeof value, `siradig.${key} should be an object`).toBe("object");
        }
      }
    });

    it("base URL is a valid AFIP URL", () => {
      expect(ARCA_SELECTORS.siradig.baseUrl).toMatch(/^https:\/\/.*afip\.gob\.ar/);
    });
  });

  describe("siradigPresentaciones selectors", () => {
    it("contains all required presentacion selectors", () => {
      const sel = ARCA_SELECTORS.siradigPresentaciones;
      expect(sel.consultaBtn).toBeDefined();
      expect(sel.consultaTab).toBeDefined();
      expect(sel.formulariosTable).toBeDefined();
      expect(sel.formulariosTableRows).toBeDefined();
      expect(sel.printDropdownBtn).toBeDefined();
      expect(sel.printSeccionA).toBeDefined();
      expect(sel.cargaFormularioBtn).toBeDefined();
      expect(sel.vistaPrevia).toBeDefined();
      expect(sel.imprimirBorrador).toBeDefined();
      expect(sel.enviarEmpleador).toBeDefined();
      expect(sel.generarPresentacion).toBeDefined();
      expect(sel.cancelarEnvio).toBeDefined();
    });

    it("all presentacion selectors are non-empty strings", () => {
      for (const [key, value] of Object.entries(ARCA_SELECTORS.siradigPresentaciones)) {
        expect(typeof value, `siradigPresentaciones.${key} should be a string`).toBe("string");
        expect(value.length, `siradigPresentaciones.${key} should be non-empty`).toBeGreaterThan(0);
      }
    });

    it("table selector uses a specific ID", () => {
      expect(ARCA_SELECTORS.siradigPresentaciones.formulariosTable).toBe("#tabla_formularios");
    });

    it("row selector targets data rows with data-id-reg attribute", () => {
      expect(ARCA_SELECTORS.siradigPresentaciones.formulariosTableRows).toContain("data-id-reg");
    });

    it("buttons use specific IDs from SiRADIG", () => {
      expect(ARCA_SELECTORS.siradigPresentaciones.vistaPrevia).toBe("#btn_vista_previa");
      expect(ARCA_SELECTORS.siradigPresentaciones.imprimirBorrador).toBe("#btn_imprimir_borrador");
      expect(ARCA_SELECTORS.siradigPresentaciones.enviarEmpleador).toBe("#btn_enviar_empleador");
    });
  });

  describe("no null or undefined values in any selector group", () => {
    it("login has no null/undefined values", () => {
      for (const [key, value] of Object.entries(ARCA_SELECTORS.login)) {
        expect(value, `login.${key} should not be null`).not.toBeNull();
        expect(value, `login.${key} should not be undefined`).not.toBeUndefined();
      }
    });

    it("portal has no null/undefined values", () => {
      for (const [key, value] of Object.entries(ARCA_SELECTORS.portal)) {
        expect(value, `portal.${key} should not be null`).not.toBeNull();
        expect(value, `portal.${key} should not be undefined`).not.toBeUndefined();
      }
    });

    it("siradig has no null/undefined values", () => {
      for (const [key, value] of Object.entries(ARCA_SELECTORS.siradig)) {
        expect(value, `siradig.${key} should not be null`).not.toBeNull();
        expect(value, `siradig.${key} should not be undefined`).not.toBeUndefined();
        if (typeof value === "object") {
          for (const [subKey, subValue] of Object.entries(value)) {
            expect(subValue, `siradig.${key}.${subKey} should not be null`).not.toBeNull();
            expect(
              subValue,
              `siradig.${key}.${subKey} should not be undefined`,
            ).not.toBeUndefined();
          }
        }
      }
    });
  });
});

describe("SELECTOR_DESCRIPTIONS", () => {
  it("all descriptions are non-empty strings", () => {
    for (const [key, value] of Object.entries(SELECTOR_DESCRIPTIONS)) {
      expect(typeof value, `${key} description should be a string`).toBe("string");
      expect(value.length, `${key} description should be non-empty`).toBeGreaterThan(0);
    }
  });

  it("has descriptions for key selectors", () => {
    expect(SELECTOR_DESCRIPTIONS["login.cuitInput"]).toBeDefined();
    expect(SELECTOR_DESCRIPTIONS["login.claveInput"]).toBeDefined();
    expect(SELECTOR_DESCRIPTIONS["login.loginSubmit"]).toBeDefined();
    expect(SELECTOR_DESCRIPTIONS["siradig.saveButton"]).toBeDefined();
  });
});
