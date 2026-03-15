import { prisma } from "@/lib/prisma";
import { classifyCategory } from "@/lib/ocr/category-classifier";
import type { DeductionCategory, CatalogSource } from "@/generated/prisma/client";

export interface ResolveCategoryInput {
  cuit: string;
  providerName?: string;
  invoiceType?: string;
  amount?: number;
  pdfText?: string;
}

export interface CatalogEntry {
  cuit: string;
  razonSocial: string | null;
  deductionCategory: DeductionCategory;
  source: CatalogSource;
}

/**
 * Resolve the deduction category for a CUIT.
 *
 * Priority:
 *  1. Catalog hit → return immediately
 *  2. PDF text available → classify from PDF → write catalog (AI_PDF)
 *  3. Fetch business info from sistemas360.ar → classify → write catalog (AI_WEB_LOOKUP)
 *  4. Fallback: classify from invoice metadata → write catalog (AI_INVOICE)
 */
export async function resolveCategory(input: ResolveCategoryInput): Promise<string> {
  const { cuit } = input;

  // 1. Check catalog
  const existing = await getCatalogEntry(cuit);
  if (existing) return existing.deductionCategory;

  // 2. PDF-based classification
  if (input.pdfText && input.pdfText.length > 20) {
    const category = await classifyCategory(input.pdfText);
    await writeCatalogEntry(cuit, input.providerName ?? null, category, "AI_PDF");
    return category;
  }

  // 3. Web lookup + classification (try sistemas360 first, then cuitonline)
  const webInfo = (await lookupCuit360(cuit)) ?? (await lookupCuitOnline(cuit));
  if (webInfo) {
    const classificationText = buildClassificationText(input, webInfo);
    const category = await classifyCategory(classificationText);
    await writeCatalogEntry(
      cuit,
      webInfo.razonSocial ?? input.providerName ?? null,
      category,
      "AI_WEB_LOOKUP",
    );
    return category;
  }

  // 4. Fallback: classify from invoice metadata alone
  const fallbackText = buildClassificationText(input, null);
  const category = await classifyCategory(fallbackText);
  await writeCatalogEntry(cuit, input.providerName ?? null, category, "AI_INVOICE");
  return category;
}

/**
 * Get an existing catalog entry by CUIT.
 */
export async function getCatalogEntry(cuit: string): Promise<CatalogEntry | null> {
  return prisma.providerCatalog.findUnique({ where: { cuit } });
}

/**
 * Write a catalog entry. Uses upsert with no-op on conflict to handle races.
 */
async function writeCatalogEntry(
  cuit: string,
  razonSocial: string | null,
  category: string,
  source: CatalogSource,
): Promise<void> {
  try {
    await prisma.providerCatalog.upsert({
      where: { cuit },
      create: {
        cuit,
        razonSocial: razonSocial ?? undefined,
        deductionCategory: category as DeductionCategory,
        source,
      },
      // Never overwrite an existing entry
      update: {},
    });
  } catch {
    // Ignore constraint violations from concurrent writes
  }
}

// ── sistemas360.ar lookup ───────────────────────────────────

export interface WebLookupResult {
  razonSocial: string | null;
  actividades: string[];
}

/**
 * Fetch business info from sistemas360.ar for a given CUIT.
 * Returns null if the lookup fails or yields no useful data.
 */
export async function lookupCuit360(cuit: string): Promise<WebLookupResult | null> {
  try {
    const resp = await fetch(`https://sistemas360.ar/cuit/${cuit}`, {
      signal: AbortSignal.timeout(5_000),
      headers: { "User-Agent": "desgrava.ar/1.0" },
    });
    if (!resp.ok) return null;

    const html = await resp.text();
    return parseBusinessInfo(html);
  } catch {
    return null;
  }
}

/**
 * Parse the HTML from sistemas360.ar to extract razon social and activities.
 */
export function parseBusinessInfo(html: string): WebLookupResult | null {
  // Extract razon social from <title>
  // Title format: "CUIT 30-12345678-9 - RAZON SOCIAL | Sistemas360"
  // The CUIT part has format XX-XXXXXXXX-X, so we skip past the last "- " before the name
  const titleMatch = html.match(/<title>CUIT\s+[\d-]+\s+-\s+(.+?)\s*\|/i);
  const razonSocial = titleMatch?.[1]?.trim() ?? null;

  // Extract activities from the list items in the "Actividades" section
  // The page uses <li> tags for each activity description
  const actividades: string[] = [];
  const activityRegex =
    /<li[^>]*>\s*(?:<[^>]*>)*\s*([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ\s,.()\/\-]+(?:N\.C\.P\.)?)\s*(?:<[^>]*>)*\s*<\/li>/gi;
  let match;
  while ((match = activityRegex.exec(html)) !== null) {
    const text = match[1].trim();
    // Filter out non-activity items (nav links, generic text)
    if (text.length > 15 && !text.startsWith("CUIT") && !text.startsWith("VER")) {
      actividades.push(text);
    }
  }

  if (!razonSocial && actividades.length === 0) return null;

  return { razonSocial, actividades };
}

// ── cuitonline.com lookup (fallback) ─────────────────────────

/**
 * Fetch business info from cuitonline.com as a fallback when sistemas360 fails.
 *
 * Two-step process:
 *  1. Fetch /search/{cuit} to get the business name and detail page URL slug
 *  2. Fetch /detalle/{cuit}/{slug}.html to get activity descriptions
 */
export async function lookupCuitOnline(cuit: string): Promise<WebLookupResult | null> {
  try {
    const searchResp = await fetch(`https://www.cuitonline.com/search/${cuit}`, {
      signal: AbortSignal.timeout(5_000),
      headers: { "User-Agent": "desgrava.ar/1.0" },
    });
    if (!searchResp.ok) return null;

    const searchHtml = await searchResp.text();
    const parsed = parseCuitOnlineSearch(searchHtml, cuit);
    if (!parsed) return null;

    // If we got a detail slug, fetch the detail page for activities
    if (parsed.detailSlug) {
      try {
        const detailResp = await fetch(
          `https://www.cuitonline.com/detalle/${cuit}/${parsed.detailSlug}.html`,
          {
            signal: AbortSignal.timeout(5_000),
            headers: { "User-Agent": "desgrava.ar/1.0" },
          },
        );
        if (detailResp.ok) {
          const detailHtml = await detailResp.text();
          const activities = parseCuitOnlineActivities(detailHtml);
          if (activities.length > 0) {
            return { razonSocial: parsed.razonSocial, actividades: activities };
          }
        }
      } catch {
        // Detail page failed — return what we have from search
      }
    }

    // Return search-level data (name only, no activities)
    return parsed.razonSocial ? { razonSocial: parsed.razonSocial, actividades: [] } : null;
  } catch {
    return null;
  }
}

/**
 * Parse cuitonline.com search page to extract business name and detail page slug.
 */
export function parseCuitOnlineSearch(
  html: string,
  cuit: string,
): { razonSocial: string | null; detailSlug: string | null } | null {
  // Extract detail link: href="detalle/30534357016/fundacion-escuelas-san-juan.html"
  const linkRegex = new RegExp(`detalle/${cuit}/([\\w-]+)\\.html`, "i");
  const linkMatch = html.match(linkRegex);
  const detailSlug = linkMatch?.[1] ?? null;

  // Extract business name from the link text or page content
  // The search result has: <a href="detalle/...">BUSINESS NAME</a>
  let razonSocial: string | null = null;
  if (linkMatch) {
    const nameRegex = new RegExp(`detalle/${cuit}/[\\w-]+\\.html[^>]*>\\s*([^<]+)`, "i");
    const nameMatch = html.match(nameRegex);
    razonSocial = nameMatch?.[1]?.trim() ?? null;
  }

  if (!razonSocial && !detailSlug) return null;
  return { razonSocial, detailSlug };
}

/**
 * Parse cuitonline.com detail page to extract activity descriptions.
 * Activities appear as text like "SERVICIOS DE GESTIÓN Y LOGÍSTICA..." in the page.
 */
export function parseCuitOnlineActivities(html: string): string[] {
  const actividades: string[] = [];

  // Activities are in list items or table cells, all caps with activity codes
  // Match patterns like "SERVICIOS DE GESTIÓN Y LOGÍSTICA PARA EL TRANSPORTE..." or "(Code 523090)"
  const activityRegex =
    /([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ\s,.()\/\-]+(?:N\.C\.P\.)?)\s*(?:\((?:Code\s*)?\d+\))?/g;
  let match;
  while ((match = activityRegex.exec(html)) !== null) {
    const text = match[1].trim();
    // Filter: must be long enough and look like an activity description
    if (
      text.length > 20 &&
      !text.startsWith("CUIT") &&
      !text.startsWith("VER") &&
      !text.startsWith("PERSONA") &&
      !text.includes("CONSTANCIA") &&
      !text.includes("INSCRIPCI")
    ) {
      // Avoid duplicates
      if (!actividades.includes(text)) {
        actividades.push(text);
      }
    }
  }

  return actividades;
}

// ── Helpers ─────────────────────────────────────────────────

function buildClassificationText(
  input: ResolveCategoryInput,
  webInfo: WebLookupResult | null,
): string {
  const parts: string[] = [];

  if (input.providerName) parts.push(`Proveedor: ${input.providerName}`);
  if (input.invoiceType) parts.push(`Tipo: ${input.invoiceType}`);
  if (input.amount) parts.push(`Monto: $${input.amount}`);

  if (webInfo) {
    if (webInfo.razonSocial) parts.push(`Razón social: ${webInfo.razonSocial}`);
    if (webInfo.actividades.length > 0) {
      parts.push(`Actividades registradas: ${webInfo.actividades.join(", ")}`);
    }
  }

  return parts.join(" | ");
}
