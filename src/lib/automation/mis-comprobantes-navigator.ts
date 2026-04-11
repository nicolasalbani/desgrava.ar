import type { Page } from "playwright";
import { inflateRawSync } from "zlib";
import { readFileSync } from "fs";
import { ARCA_SELECTORS } from "./selectors";
import { searchAndOpenService } from "./arca-navigator";

export interface MisComprobantesResult {
  success: boolean;
  csvContent?: string;
  error?: string;
}

/**
 * Navigate from the ARCA portal to "Mis Comprobantes" service,
 * go to "Comprobantes Recibidos", search for the full fiscal year,
 * and export the results as CSV.
 *
 * The page passed in should already be logged in and on the ARCA portal.
 *
 * Flow (verified 2026-03-14):
 * 1. Click "Mis Comprobantes" in the portal → opens new tab at fes.afip.gob.ar
 * 2. Click #btnRecibidos on the landing page
 * 3. Set date range via jQuery daterangepicker API on #fechaEmision
 * 4. Click #buscarComprobantes
 * 5. Get idConsulta from the Historial tab
 * 6. Download CSV via server-side endpoint: descargarComprobantes.do?id=X&tc=R&tf=csv
 *
 * Gotchas:
 * - The daterangepicker is jQuery-based, plain fill() doesn't work — must use evaluate()
 * - CSV button triggers window.location.href (not a browser download event), so we
 *   fetch the CSV content directly via page.evaluate() + fetch()
 * - Mis Comprobantes opens in a new tab from the portal
 */
export async function navigateToMisComprobantes(
  page: Page,
  fiscalYear: number,
  onLog?: (msg: string) => void,
): Promise<MisComprobantesResult> {
  const log = onLog ?? (() => {});
  const sel = ARCA_SELECTORS.misComprobantes;

  try {
    // Search for the service directly from the current portal page (no need to
    // navigate to "/mis-servicios" — the search bar is in the portal navbar).
    const misCompPage = await searchAndOpenService(
      page,
      "Mis Comprobantes",
      "Mis Comprobantes",
      log,
    );

    // Wait for the new tab to load
    await misCompPage.waitForLoadState("networkidle", { timeout: 30_000 });
    log(`Mis Comprobantes cargado: ${misCompPage.url()}`);

    // Step 3: Click "Comprobantes Recibidos"
    log("Navegando a Comprobantes Recibidos...");
    await misCompPage.waitForSelector(sel.comprobantesRecibidosBtn, {
      timeout: 15_000,
    });
    await misCompPage.click(sel.comprobantesRecibidosBtn);
    await misCompPage.waitForLoadState("networkidle", { timeout: 30_000 });

    // Step 4: Set date range via jQuery daterangepicker API
    log(`Configurando rango de fechas para el año ${fiscalYear}...`);
    await misCompPage.waitForSelector(sel.fechaEmisionInput, {
      timeout: 10_000,
    });

    const fechaDesde = `01/01/${fiscalYear}`;
    const fechaHasta = `31/12/${fiscalYear}`;

    await misCompPage.evaluate(
      ({ desde, hasta }) => {
        const jq = (window as unknown as { jQuery: CallableFunction }).jQuery;
        if (!jq) throw new Error("jQuery not available");
        const dp = jq("#fechaEmision").data("daterangepicker");
        if (!dp) throw new Error("daterangepicker not initialized");
        dp.setStartDate(desde);
        dp.setEndDate(hasta);
        jq("#fechaEmision").val(`${desde} - ${hasta}`).trigger("change");
      },
      { desde: fechaDesde, hasta: fechaHasta },
    );
    log(`Rango de fechas: ${fechaDesde} - ${fechaHasta}`);

    // Step 5: Click search
    log("Buscando comprobantes...");
    await misCompPage.click(sel.searchButton);

    // Wait for results table or empty message
    await misCompPage
      .waitForSelector(`${sel.resultsTable}, ${sel.noResultsMessage}`, { timeout: 60_000 })
      .catch(() => {});
    await misCompPage.waitForTimeout(2000);

    // Check for no results
    const noResults = await misCompPage.$(sel.noResultsMessage);
    if (noResults) {
      const noResultsText = await noResults.textContent();
      if (noResultsText?.includes("No se encontraron") || noResultsText?.includes("No hay datos")) {
        log("No se encontraron comprobantes para el periodo seleccionado");
        await misCompPage.close();
        return { success: true, csvContent: "" };
      }
    }

    // Check total results from the info text
    const infoText = await misCompPage
      .locator(sel.resultsInfo)
      .textContent()
      .catch(() => null);
    if (infoText) {
      log(`${infoText}`);
    }

    // Step 6: Get idConsulta from the most recent history row
    log("Obteniendo ID de consulta para exportar CSV...");

    // Click Historial tab to load history
    await misCompPage.click(sel.historialTab);
    await misCompPage.waitForTimeout(2000);

    const idConsulta = await misCompPage.evaluate((rowSelector) => {
      const firstRow = document.querySelector(rowSelector);
      return firstRow?.getAttribute("data-id-consulta") ?? null;
    }, sel.historialRows as string);

    if (!idConsulta) {
      await misCompPage.close();
      return {
        success: false,
        error: "No se pudo obtener el ID de consulta del historial",
      };
    }

    log(`ID de consulta: ${idConsulta}`);

    // Step 7: Download CSV via server-side endpoint.
    // ARCA returns a ZIP file containing the CSV — we trigger a download via
    // window.location.href, capture it with Playwright, and extract the CSV.
    log("Descargando CSV...");
    const downloadPath = sel.csvDownloadPath as string;
    const [download] = await Promise.all([
      misCompPage.waitForEvent("download", { timeout: 30_000 }),
      misCompPage.evaluate(
        ({ path, id }) => {
          window.location.href = `${path}?id=${id}&tc=R&tf=csv`;
        },
        { path: downloadPath, id: idConsulta },
      ),
    ]);

    const zipPath = await download.path();
    if (!zipPath) {
      throw new Error("No se pudo descargar el archivo ZIP");
    }

    const csvContent = extractCsvFromZip(readFileSync(zipPath));
    log(`CSV descargado: ${csvContent.length} caracteres`);

    // Close the Mis Comprobantes tab
    await misCompPage.close();

    return { success: true, csvContent };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error en Mis Comprobantes: ${msg} | URL: ${page.url()}`);
    return { success: false, error: msg };
  }
}

/**
 * Extract a CSV file from a ZIP buffer.
 * ARCA's descargarComprobantes.do returns a ZIP containing a single CSV.
 * Uses Node's built-in zlib (no external deps) by parsing the ZIP format.
 *
 * ARCA's ZIP uses data descriptors (bit 3 flag), so compressed size in the
 * local file header is 0. We read the actual size from the central directory.
 */
function extractCsvFromZip(zipBuffer: Buffer): string {
  // ZIP local file header signature: PK\x03\x04
  if (
    zipBuffer[0] !== 0x50 ||
    zipBuffer[1] !== 0x4b ||
    zipBuffer[2] !== 0x03 ||
    zipBuffer[3] !== 0x04
  ) {
    // Not a ZIP — assume it's already CSV text
    return zipBuffer.toString("utf-8");
  }

  const compressionMethod = zipBuffer.readUInt16LE(8);
  let compressedSize = zipBuffer.readUInt32LE(18);
  const fileNameLength = zipBuffer.readUInt16LE(26);
  const extraFieldLength = zipBuffer.readUInt16LE(28);
  const dataOffset = 30 + fileNameLength + extraFieldLength;

  // If compressed size is 0, the ZIP uses data descriptors (bit 3 flag).
  // Read the actual size from the End of Central Directory → Central Directory.
  if (compressedSize === 0) {
    // Find End of Central Directory record (PK\x05\x06)
    for (let i = zipBuffer.length - 22; i >= 0; i--) {
      if (
        zipBuffer[i] === 0x50 &&
        zipBuffer[i + 1] === 0x4b &&
        zipBuffer[i + 2] === 0x05 &&
        zipBuffer[i + 3] === 0x06
      ) {
        const cdOffset = zipBuffer.readUInt32LE(i + 16);
        compressedSize = zipBuffer.readUInt32LE(cdOffset + 20);
        break;
      }
    }
    if (compressedSize === 0) {
      throw new Error("No se pudo determinar el tamaño del archivo en el ZIP");
    }
  }

  const compressedData = zipBuffer.subarray(dataOffset, dataOffset + compressedSize);

  if (compressionMethod === 0) {
    // Stored (no compression)
    return compressedData.toString("utf-8");
  } else if (compressionMethod === 8) {
    // Deflate
    return inflateRawSync(compressedData).toString("utf-8");
  } else {
    throw new Error(`Metodo de compresion ZIP no soportado: ${compressionMethod}`);
  }
}
