import { describe, it, expect } from "vitest";
import {
  parseBusinessInfo,
  parseCuitOnlineSearch,
  parseCuitOnlineActivities,
  isObviouslyNonDeductible,
} from "@/lib/catalog/provider-catalog";

// ── parseBusinessInfo ────────────────────────────────────────

describe("parseBusinessInfo", () => {
  it("extracts razon social from new title format", () => {
    const html = `<html><head><title>Buscador de CUIT – MAYCAR SOCIEDAD ANONIMA (CUIT 30-61286533-3)</title></head><body></body></html>`;
    const result = parseBusinessInfo(html);
    expect(result).not.toBeNull();
    expect(result!.razonSocial).toBe("MAYCAR SOCIEDAD ANONIMA");
  });

  it("extracts razon social from old title format", () => {
    const html = `<html><head><title>CUIT 30-61286533-3 - MAYCAR SOCIEDAD ANONIMA | Sistemas360</title></head><body></body></html>`;
    const result = parseBusinessInfo(html);
    expect(result).not.toBeNull();
    expect(result!.razonSocial).toBe("MAYCAR SOCIEDAD ANONIMA");
  });

  it("extracts activities from list items", () => {
    const html = `
      <html><head><title>CUIT 30-61286533-3 - TEST SA | Sistemas360</title></head>
      <body>
        <ul>
          <li>ELABORACIÓN DE PRODUCTOS ALIMENTICIOS N.C.P.</li>
          <li>VENTA AL POR MAYOR EN COMISIÓN O CONSIGNACIÓN DE MERCADERÍAS N.C.P.</li>
          <li>SERVICIOS INMOBILIARIOS REALIZADOS POR CUENTA PROPIA, CON BIENES URBANOS PROPIOS O ARRENDADOS N.C.P.</li>
        </ul>
      </body></html>
    `;
    const result = parseBusinessInfo(html);
    expect(result).not.toBeNull();
    expect(result!.actividades).toHaveLength(3);
    expect(result!.actividades[0]).toBe("ELABORACIÓN DE PRODUCTOS ALIMENTICIOS N.C.P.");
    expect(result!.actividades[2]).toContain("SERVICIOS INMOBILIARIOS");
  });

  it("filters out short or nav-like items", () => {
    const html = `
      <html><head><title>CUIT 30-12345678-9 - TEST | Sistemas360</title></head>
      <body>
        <ul>
          <li>VER MAS</li>
          <li>CUIT 12345</li>
          <li>SHORT</li>
          <li>SERVICIOS DE MEDICINA PREPAGA N.C.P.</li>
        </ul>
      </body></html>
    `;
    const result = parseBusinessInfo(html);
    expect(result!.actividades).toHaveLength(1);
    expect(result!.actividades[0]).toBe("SERVICIOS DE MEDICINA PREPAGA N.C.P.");
  });

  it("returns null for empty HTML with no useful data", () => {
    const result = parseBusinessInfo("<html><head><title>Error</title></head><body></body></html>");
    expect(result).toBeNull();
  });

  it("returns result with only razon social when no activities", () => {
    const html = `<html><head><title>Buscador de CUIT – EMPRESA TEST SA (CUIT 30-12345678-9)</title></head><body><p>No data</p></body></html>`;
    const result = parseBusinessInfo(html);
    expect(result).not.toBeNull();
    expect(result!.razonSocial).toBe("EMPRESA TEST SA");
    expect(result!.actividades).toHaveLength(0);
  });

  it("returns result with only activities when no title match", () => {
    const html = `
      <html><head><title>Sistemas360</title></head>
      <body>
        <li>SERVICIOS DE ASESORAMIENTO, DIRECCIÓN Y GESTIÓN EMPRESARIAL REALIZADOS POR INTEGRANTES DE LOS ÓRGANOS DE ADMINISTRACIÓN</li>
      </body></html>
    `;
    const result = parseBusinessInfo(html);
    expect(result).not.toBeNull();
    expect(result!.razonSocial).toBeNull();
    expect(result!.actividades.length).toBeGreaterThan(0);
  });

  it("handles activities with HTML tags inside li", () => {
    const html = `
      <html><head><title>Buscador de CUIT – TEST SA (CUIT 30-12345678-9)</title></head>
      <body>
        <li><span>SERVICIOS RELACIONADOS CON LA SALUD HUMANA N.C.P.</span></li>
      </body></html>
    `;
    const result = parseBusinessInfo(html);
    expect(result!.actividades).toContain("SERVICIOS RELACIONADOS CON LA SALUD HUMANA N.C.P.");
  });

  it("handles real-world HTML structure from sistemas360", () => {
    const html = `
      <html>
      <head><title>Buscador de CUIT – MELI LOG SRL (CUIT 30-71568605-4)</title></head>
      <body>
        <h6>Datos de Régimen General</h6>
        <p>Actividades:</p>
        <ul>
          <li>SERVICIO DE TRANSPORTE AUTOMOTOR DE CARGAS N.C.P.</li>
          <li>SERVICIOS DE ALMACENAMIENTO Y DEPÓSITO N.C.P.</li>
        </ul>
      </body>
      </html>
    `;
    const result = parseBusinessInfo(html);
    expect(result).not.toBeNull();
    expect(result!.razonSocial).toBe("MELI LOG SRL");
    expect(result!.actividades).toEqual([
      "SERVICIO DE TRANSPORTE AUTOMOTOR DE CARGAS N.C.P.",
      "SERVICIOS DE ALMACENAMIENTO Y DEPÓSITO N.C.P.",
    ]);
  });
});

// ── parseCuitOnlineSearch ────────────────────────────────────

describe("parseCuitOnlineSearch", () => {
  it("extracts detail slug and razon social from search page", () => {
    const html = `<a href="detalle/30534357016/fundacion-escuelas-san-juan.html">FUNDACION ESCUELAS SAN JUAN</a>`;
    const result = parseCuitOnlineSearch(html, "30534357016");
    expect(result).not.toBeNull();
    expect(result!.detailSlug).toBe("fundacion-escuelas-san-juan");
    expect(result!.razonSocial).toBe("FUNDACION ESCUELAS SAN JUAN");
  });

  it("returns null for HTML with no matching link", () => {
    const html = `<html><body><p>No results</p></body></html>`;
    const result = parseCuitOnlineSearch(html, "99999999999");
    expect(result).toBeNull();
  });

  it("handles link with extra attributes", () => {
    const html = `<a class="result" href="detalle/30715686054/meli-log-srl.html" title="ver">MELI LOG SRL</a>`;
    const result = parseCuitOnlineSearch(html, "30715686054");
    expect(result).not.toBeNull();
    expect(result!.detailSlug).toBe("meli-log-srl");
    expect(result!.razonSocial).toBe("MELI LOG SRL");
  });

  it("extracts razon social from title attribute when inner text is absent", () => {
    const html = `<a href="detalle/30545758314/subterraneos-de-buenos-aires-sociedad-del-estado.html" title="Ver detalles de SUBTERRANEOS DE BUENOS AIRES SOCIEDAD DEL ESTADO" class="denominacion"></a>`;
    const result = parseCuitOnlineSearch(html, "30545758314");
    expect(result).not.toBeNull();
    expect(result!.detailSlug).toBe("subterraneos-de-buenos-aires-sociedad-del-estado");
    expect(result!.razonSocial).toBe("SUBTERRANEOS DE BUENOS AIRES SOCIEDAD DEL ESTADO");
  });

  it("prefers title attribute over inner text", () => {
    const html = `<a href="detalle/30545758314/subterraneos-de-buenos-aires-sociedad-del-estado.html" title="Ver detalles de SUBTERRANEOS DE BUENOS AIRES SOCIEDAD DEL ESTADO" class="denominacion">SUBTERRANEOS DE BUENOS AIRES SOCIEDAD DEL ESTADO</a>`;
    const result = parseCuitOnlineSearch(html, "30545758314");
    expect(result).not.toBeNull();
    expect(result!.razonSocial).toBe("SUBTERRANEOS DE BUENOS AIRES SOCIEDAD DEL ESTADO");
  });

  it("handles slugs that contain dots for legal suffixes like s.r.l", () => {
    const html = `<a href="detalle/30717882780/central-ortopedica-junin-s.r.l.html" title="Ver detalles de CENTRAL ORTOPEDICA JUNIN S.R.L." class="denominacion">CENTRAL ORTOPEDICA JUNIN S.R.L.</a>`;
    const result = parseCuitOnlineSearch(html, "30717882780");
    expect(result).not.toBeNull();
    expect(result!.detailSlug).toBe("central-ortopedica-junin-s.r.l");
    expect(result!.razonSocial).toBe("CENTRAL ORTOPEDICA JUNIN S.R.L.");
  });
});

// ── parseCuitOnlineActivities ────────────────────────────────

describe("parseCuitOnlineActivities", () => {
  it("extracts activity descriptions from detail page", () => {
    const html = `
      <div>SERVICIOS DE GESTIÓN Y LOGÍSTICA PARA EL TRANSPORTE DE MERCADERÍAS N.C.P.</div>
      <div>SERVICIOS DE MANIPULACIÓN DE CARGA EN EL ÁMBITO TERRESTRE</div>
    `;
    const result = parseCuitOnlineActivities(html);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toContain("SERVICIOS DE GESTIÓN Y LOGÍSTICA");
  });

  it("filters out non-activity text", () => {
    const html = `
      <span>PERSONA JURÍDICA</span>
      <span>CONSTANCIA DE INSCRIPCIÓN</span>
      <span>VER DETALLES</span>
      <span>CUIT 30-12345678-9</span>
      <div>VENTA AL POR MENOR EN SUPERMERCADOS</div>
    `;
    const result = parseCuitOnlineActivities(html);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("VENTA AL POR MENOR EN SUPERMERCADOS");
  });

  it("deduplicates repeated activities", () => {
    const html = `
      <li>SERVICIOS RELACIONADOS CON LA SALUD HUMANA N.C.P.</li>
      <td>SERVICIOS RELACIONADOS CON LA SALUD HUMANA N.C.P.</td>
    `;
    const result = parseCuitOnlineActivities(html);
    expect(result).toHaveLength(1);
  });

  it("returns empty array for HTML with no activities", () => {
    const html = `<html><body><p>No data</p></body></html>`;
    expect(parseCuitOnlineActivities(html)).toEqual([]);
  });
});

// ── isObviouslyNonDeductible ──────────────────────────────────

describe("isObviouslyNonDeductible", () => {
  it.each([
    "AUTOSERVICIO MAYORISTA DIARCO SA",
    "SUPERMERCADO CARREFOUR",
    "COTO CICSA",
    "JUMBO RETAIL ARGENTINA SA",
    "DISCO SA",
    "HIPERMERCADO LIBERTAD SA",
    "ESTACION DE SERVICIO EL CRUCE",
    "YPF SA",
    "SHELL CAPSA",
    "AXION ENERGY ARGENTINA SRL",
    "RAPPI ARG SAS",
    "PEDIDOSYA SA",
    "MERCADOLIBRE SRL",
    "MERCADO LIBRE SRL",
    "MAXICONSUMO SA",
    "RESTAURANTE LA PARRILLA",
    "PANADERIA EL TRIGAL",
  ])("returns true for '%s'", (name) => {
    expect(isObviouslyNonDeductible(name)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isObviouslyNonDeductible("autoservicio mayorista diarco sa")).toBe(true);
    expect(isObviouslyNonDeductible("SUPERMERCADO CARREFOUR")).toBe(true);
  });

  it.each([
    "OSDE",
    "SWISS MEDICAL",
    "FUNDACION ESCUELAS SAN JUAN",
    "DA SILVA BAREIRO VIVIANA ELIZABETH",
    "SANCOR COOPERATIVA DE SEGUROS LIMITADA",
    "STARLINK ARGENTINA S R L",
    "",
  ])("returns false for '%s'", (name) => {
    expect(isObviouslyNonDeductible(name)).toBe(false);
  });
});
