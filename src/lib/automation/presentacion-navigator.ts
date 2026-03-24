/**
 * Presentación navigator for SiRADIG form submissions.
 *
 * Pull flow: Consulta de Formularios Enviados → scrape table → download PDFs
 * Submit flow: Carga de Formulario → Vista Previa → Imprimir Borrador → Enviar al Empleador → Generar Presentación
 *
 * Page structure verified 2026-03-21 via /arca-assisted-navigation:
 * - Table: #tabla_formularios with tbody tr[data-id-reg] rows
 * - Print dropdown: div.boton.con_menu per row → #menu_btn_imprimir_a for Sección A PDF
 * - PDF download navigates to /radig/jsp/descargarPDF.do?id=<session>&s=a (not a download event)
 * - Vista Previa: #btn_vista_previa (on /radig/jsp/verMenuDeducciones.do)
 * - Imprimir Borrador: #btn_imprimir_borrador (on /radig/jsp/vistaPreviaFormulario.do)
 * - Enviar al Empleador: #btn_enviar_empleador (opens jQuery UI dialog)
 * - Generar Presentación: .ui-dialog-buttonset button with text "Generar Presentación"
 *
 * Gotchas:
 * - PDF download for "Consulta" navigates the page instead of triggering a download event.
 *   We intercept the response body instead.
 * - The print dropdown uses jQuery UI menu — clicking the div opens the menu,
 *   then click #menu_btn_imprimir_a for Sección A.
 */
import type { Page, Download } from "playwright";
import { ARCA_SELECTORS } from "./selectors";

type ScreenshotCallback = (buffer: Buffer, slug: string, label: string) => Promise<void>;

interface PullResult {
  success: boolean;
  presentaciones: PresentacionData[];
  error?: string;
}

export interface PresentacionData {
  numero: number;
  descripcion: string;
  fechaEnvio: string; // dd/mm/yyyy
  fechaLectura: string | null; // dd/mm/yyyy or null
  pdfBuffer: Buffer | null;
}

interface SubmitResult {
  success: boolean;
  numero?: number;
  descripcion?: string;
  pdfBuffer?: Buffer;
  error?: string;
}

const SEL = ARCA_SELECTORS.siradigPresentaciones;

/**
 * Navigate to "Consulta de Formularios Enviados" and scrape all presentaciones.
 * Assumes the page is already on the SiRADIG form page (after navigateToDeductionSection).
 */
export async function pullPresentaciones(
  page: Page,
  fiscalYear: number,
  onLog?: (msg: string) => void,
  onScreenshot?: ScreenshotCallback,
): Promise<PullResult> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});
  const presentaciones: PresentacionData[] = [];

  try {
    // First navigate to "Carga de Formulario" — this makes the top tab nav bar visible.
    // On the main menu, #tab_principal_consultas exists but is hidden (jQuery slideDown).
    // After entering "Carga de Formulario", the tab nav shows all section links.
    log("Accediendo a Carga de Formulario...");
    const formBtn = page.locator(SEL.cargaFormularioBtn);
    await formBtn.waitFor({ state: "visible", timeout: 15000 });
    await formBtn.click();
    await page.waitForLoadState("networkidle");

    // Now click "Consulta de Formularios Enviados" from the top tab nav
    log("Navegando a Consulta de Formularios Enviados...");
    const consultaTab = page.locator(SEL.consultaTab);
    await consultaTab.waitFor({ state: "visible", timeout: 15000 });
    await consultaTab.click();
    await page.waitForLoadState("networkidle");

    await capture(
      await page.screenshot({ fullPage: true }),
      "consulta-formularios",
      "Consulta de Formularios Enviados",
    );

    // Wait for the table to appear — it may not exist if there are no presentaciones
    const table = page.locator(SEL.formulariosTable);
    const tableVisible = await table.isVisible().catch(() => false);
    if (!tableVisible) {
      // Wait a bit more in case it's loading
      try {
        await table.waitFor({ timeout: 5000 });
      } catch {
        // No table means no presentaciones for this period — this is a valid state
        log("No hay presentaciones enviadas para este periodo");
        await capture(
          await page.screenshot({ fullPage: true }),
          "no-presentaciones",
          "Sin presentaciones",
        );
        return { success: true, presentaciones: [] };
      }
    }

    // Step 1: Scrape all row data first (before any navigation that would invalidate locators)
    const rows = page.locator(SEL.formulariosTableRows);
    const rowCount = await rows.count();
    log(`Encontradas ${rowCount} presentaciones`);

    interface RowData {
      idReg: string;
      numero: number;
      descripcion: string;
      fechaEnvio: string;
      fechaLectura: string | null;
    }
    const rowsData: RowData[] = [];

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const cells = row.locator("td");
      const cellCount = await cells.count();
      if (cellCount < 4) continue;

      const idReg = (await row.getAttribute("data-id-reg")) ?? "";
      const numero = parseInt((await cells.nth(0).textContent()) ?? "0");
      const descripcion = ((await cells.nth(1).textContent()) ?? "").trim();
      const fechaEnvio = ((await cells.nth(2).textContent()) ?? "").trim();
      const fechaLecturaRaw = ((await cells.nth(3).textContent()) ?? "").trim();
      const fechaLectura = fechaLecturaRaw === "-" || !fechaLecturaRaw ? null : fechaLecturaRaw;

      rowsData.push({ idReg, numero, descripcion, fechaEnvio, fechaLectura });
    }

    // Remember the formularios page URL so we can navigate back reliably
    const formulariosUrl = page.url();

    // Step 2: Download PDFs one by one using direct URL construction
    // Each download navigates away from the page, so we go back after each one.
    for (const rd of rowsData) {
      log(`Presentacion ${rd.numero}: ${rd.descripcion} (${rd.fechaEnvio})`);

      let pdfBuffer: Buffer | null = null;
      if (rd.idReg) {
        try {
          const pdfUrl = `descargarPDF.do?id=${rd.idReg}&s=a`;
          log(`Descargando PDF: ${pdfUrl}`);

          const [download] = await Promise.all([
            page.waitForEvent("download", { timeout: 15000 }),
            page.evaluate((url) => {
              document.location.href = url;
            }, pdfUrl),
          ]);
          pdfBuffer = await downloadToBuffer(download);
          log(`PDF descargado para presentacion ${rd.numero}`);

          // Navigate back to the formularios page
          await page.goto(formulariosUrl, { waitUntil: "networkidle" });
          await page.waitForTimeout(500);
        } catch {
          log(`No se pudo descargar PDF para presentacion ${rd.numero}`);
          // Ensure we're back on the formularios page for the next iteration
          try {
            await page.goto(formulariosUrl, { waitUntil: "networkidle" });
            await page.waitForTimeout(500);
          } catch {
            // best effort
          }
        }
      }

      presentaciones.push({
        numero: rd.numero,
        descripcion: rd.descripcion,
        fechaEnvio: rd.fechaEnvio,
        fechaLectura: rd.fechaLectura,
        pdfBuffer,
      });
    }

    await capture(
      await page.screenshot({ fullPage: true }),
      "pull-complete",
      "Importacion completada",
    );

    return { success: true, presentaciones };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error al importar presentaciones: ${msg}`);
    return { success: false, presentaciones, error: msg };
  }
}

/**
 * Submit a new presentación: Vista Previa → Imprimir Borrador → Enviar al Empleador → Generar.
 * Assumes the page is already on the SiRADIG form page (after navigateToDeductionSection).
 */
export async function submitPresentacion(
  page: Page,
  fiscalYear: number,
  onLog?: (msg: string) => void,
  onScreenshot?: ScreenshotCallback,
): Promise<SubmitResult> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});

  try {
    // Navigate to "Carga de Formulario" first (we start at the SiRADIG main menu)
    log("Accediendo a Carga de Formulario...");
    const formBtn = page.locator(SEL.cargaFormularioBtn);
    await formBtn.waitFor({ state: "visible", timeout: 15000 });
    await formBtn.click();
    await page.waitForLoadState("networkidle");

    // Click Vista Previa (should be visible on the form page)
    log("Haciendo click en Vista Previa...");
    const vistaPrevia = page.locator(SEL.vistaPrevia);
    await vistaPrevia.waitFor({ state: "visible", timeout: 15000 });
    await vistaPrevia.click();
    await page.waitForLoadState("networkidle");

    await capture(
      await page.screenshot({ fullPage: true }),
      "vista-previa",
      "Vista Previa del formulario",
    );

    // Download Borrador PDF via Imprimir Borrador
    log("Descargando borrador PDF...");
    let pdfBuffer: Buffer | undefined;
    try {
      const imprimirBtn = page.locator(SEL.imprimirBorrador);
      await imprimirBtn.waitFor({ state: "visible", timeout: 15000 });

      // Imprimir Borrador may trigger a download or navigate to a PDF URL
      // Try download event first, fall back to response interception
      try {
        const [download] = await Promise.all([
          page.waitForEvent("download", { timeout: 10000 }),
          imprimirBtn.click(),
        ]);
        pdfBuffer = await downloadToBuffer(download);
      } catch {
        // If download event doesn't fire, the button may navigate to a PDF URL
        // Check if page navigated to a PDF
        if (page.url().includes("descargarPDF") || page.url().includes("imprimirBorrador")) {
          // We're on the PDF page — go back
          await page.goBack();
          await page.waitForLoadState("networkidle");
        }
      }
      if (pdfBuffer) {
        log("Borrador PDF descargado");
      }
    } catch {
      log("No se pudo descargar el borrador PDF, continuando con el envio...");
    }

    await capture(
      await page.screenshot({ fullPage: true }),
      "after-print",
      "Despues de imprimir borrador",
    );

    // Click Enviar al Empleador (opens jQuery UI confirmation dialog)
    log("Enviando al empleador...");
    const enviarBtn = page.locator(SEL.enviarEmpleador);
    await enviarBtn.waitFor({ state: "visible", timeout: 15000 });
    await enviarBtn.click();
    await page.waitForTimeout(1000);

    await capture(
      await page.screenshot({ fullPage: true }),
      "enviar-empleador",
      "Confirmacion de envio",
    );

    // Confirm by clicking Generar Presentación in the dialog
    log("Confirmando: Generar Presentacion...");
    const generarBtn = page.locator(SEL.generarPresentacion);
    await generarBtn.waitFor({ state: "visible", timeout: 15000 });
    await generarBtn.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await capture(
      await page.screenshot({ fullPage: true }),
      "presentacion-generada",
      "Presentacion generada",
    );

    // Try to extract the presentación number and description from the page
    let numero: number | undefined;
    let descripcion: string | undefined;

    try {
      const pageText = await page.textContent("body");
      if (pageText) {
        const nroMatch = pageText.match(/Presentaci[oó]n\s+(?:Nro\.?|N[°º])?\s*:?\s*(\d+)/i);
        if (nroMatch) numero = parseInt(nroMatch[1]);

        const descMatch = pageText.match(/(Original|Rectificativa\s*\d+)/i);
        if (descMatch) descripcion = descMatch[1];
      }
    } catch {
      // Best-effort extraction
    }

    log(
      `Presentacion enviada exitosamente${numero ? ` (N° ${numero} - ${descripcion ?? ""})` : ""}`,
    );

    return { success: true, numero, descripcion, pdfBuffer };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error al enviar presentacion: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Extract "Deducciones y desgravaciones" total amount from a presentación PDF.
 * The PDF text may contain "(continuación)" between the label and amount when the
 * section spans multiple pages, e.g.:
 *   "Deducciones y desgravaciones   $   (continuación) 17.378.002,61"
 * Returns the amount as a string like "17378002.61" or null if not found.
 */
export function extractMontoTotalFromText(pdfText: string): string | null {
  // Match "Deducciones y desgravaciones" followed by $ and an amount,
  // allowing optional "(continuación)" or other text between $ and the number.
  const match = pdfText.match(
    /[Dd]educciones\s+y\s+[Dd]esgrav(?:aciones|ámenes)\s+\$\s+(?:\(continuaci[oó]n\)\s+)?([\d.,]+)/,
  );
  if (!match) return null;
  // Convert Argentine format "17.378.002,61" → "17378002.61"
  return match[1].replace(/\./g, "").replace(",", ".");
}

async function downloadToBuffer(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
