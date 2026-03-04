import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { processDocument } from "../pipeline";

function fixture(name: string) {
  const p = path.join(__dirname, "fixtures", name);
  return { path: p, exists: existsSync(p) };
}

// ---------------------------------------------------------------------------
// ARCA Factura C — psychology session (DA SILVA BAREIRO VIVIANA ELIZABETH)
// Place PDF at: src/lib/ocr/__tests__/fixtures/arca-factura-c.pdf
// ---------------------------------------------------------------------------
const arca = fixture("arca-factura-c.pdf");

describe.skipIf(!arca.exists)("processDocument — ARCA Factura C (arca-factura-c.pdf)", () => {
  it("extracts all fields correctly from the real PDF", async () => {
    const result = await processDocument(readFileSync(arca.path), "application/pdf");

    expect(result.method).toBe("pdf-parse");
    expect(result.fields.invoiceType).toBe("FACTURA_C");
    expect(result.fields.cuit).toBe("23295029544");
    expect(result.fields.invoiceNumber).toBe("00002-00000670");
    expect(result.fields.amount).toBe(40000);
    expect(result.fields.date).toBe("2026-03-04");
    expect(result.fields.providerName).toBe("DA SILVA BAREIRO VIVIANA ELIZABETH");
    expect(result.fields.confidence).toBe(1);
  }, 30_000);
});

// ---------------------------------------------------------------------------
// AFIP Factura C — education (FUNDACIÓN ESCUELAS SAN JUAN)
// Place PDF at: src/lib/ocr/__tests__/fixtures/afip-factura-c.pdf
// ---------------------------------------------------------------------------
const afip = fixture("afip-factura-c.pdf");

// ---------------------------------------------------------------------------
// ARCA Factura B — Starlink Argentina S.R.L.
// Place PDF at: src/lib/ocr/__tests__/fixtures/arca-factura-b.pdf
// ---------------------------------------------------------------------------
const starlinkB = fixture("arca-factura-b.pdf");

describe.skipIf(!starlinkB.exists)("processDocument — ARCA Factura B (arca-factura-b.pdf)", () => {
  it("extracts all fields correctly from the real PDF", async () => {
    const result = await processDocument(readFileSync(starlinkB.path), "application/pdf");

    expect(result.method).toBe("pdf-parse");
    expect(result.fields.invoiceType).toBe("FACTURA_B");
    expect(result.fields.cuit).toBe("30717540871");
    expect(result.fields.invoiceNumber).toBe("00002-03042175");
    expect(result.fields.amount).toBe(56100);
    expect(result.fields.date).toBe("2026-01-04");
    expect(result.fields.providerName).toMatch(/Starlink Argentina S\.R\.L\./i);
    expect(result.fields.confidence).toBe(1);
  }, 30_000);
});

describe.skipIf(!afip.exists)("processDocument — AFIP Factura C (afip-factura-c.pdf)", () => {
  it("extracts all fields correctly from the real PDF", async () => {
    const result = await processDocument(readFileSync(afip.path), "application/pdf");

    expect(result.method).toBe("pdf-parse");
    expect(result.fields.invoiceType).toBe("FACTURA_C");
    expect(result.fields.cuit).toBe("30534357016");
    expect(result.fields.invoiceNumber).toBe("00006-00142033");
    expect(result.fields.amount).toBe(959730);
    expect(result.fields.date).toBe("2026-03-01");
    expect(result.fields.providerName).toMatch(/FUNDACI[OÓ]N ESCUELAS SAN JUAN/i);
    expect(result.fields.confidence).toBe(1);
  }, 30_000);
});
