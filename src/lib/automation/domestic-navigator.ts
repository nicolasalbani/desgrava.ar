import type { Page } from "playwright";
import { searchAndOpenService } from "./arca-navigator";

export interface DomesticWorkerData {
  cuil: string;
  apellidoNombre: string;
  tipoTrabajo: string;
  domicilioLaboral: string | null;
  horasSemanales: string | null;
  condicion: string;
  obraSocial: string | null;
  fechaNacimiento: string | null;
  fechaIngreso: string | null;
  modalidadPago: string | null;
  modalidadTrabajo: string | null;
  remuneracionPactada: string | null;
}

export interface DomesticReceiptData {
  workerCuil: string;
  periodo: string;
  fiscalYear: number;
  fiscalMonth: number;
  pago: number; // contribution amount from the table
  sueldo: number; // salary from the table
  pdfBuffer: Buffer | null;
  pdfFilename: string | null;
  paymentDetails: Array<{ tipoPago: string; importe: number; fechaPago: string }>;
}

interface PullDomesticResult {
  workers: DomesticWorkerData[];
  receipts: DomesticReceiptData[];
}

const MONTH_MAP: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function parsePeriodo(text: string): { month: number; year: number } | null {
  const match = text.trim().match(/([A-Za-záéíóúÁÉÍÓÚ]+)\s+(\d{4})/);
  if (!match) return null;
  const month = MONTH_MAP[match[1].toLowerCase()];
  const year = parseInt(match[2]);
  if (!month || !year) return null;
  return { month, year };
}

function parseAmount(text: string): number {
  const cleaned = text.replace(/[$\s]/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

/**
 * Check if the page shows a "Cerraste la sesión" / session-expired state.
 * This happens when the service redirects to www.trabajadores-casas-particulares.gob.ar
 * which is a different domain that doesn't share the ARCA session cookies.
 */
async function isSessionExpiredPage(page: Page): Promise<boolean> {
  const url = page.url();
  if (url.includes("trabajadores-casas-particulares.gob.ar")) return true;

  try {
    const text = await page.locator("body").innerText({ timeout: 3000 });
    if (text.includes("Cerraste la sesión") || text.includes("VOLVER A INGRESAR")) {
      return true;
    }
  } catch {
    // Timeout reading body
  }
  return false;
}

/**
 * Open "Personal de Casas Particulares" via the ARCA portal's navbar search bar.
 *
 * Direct goto() to the service URL does NOT work because the session is established
 * through a redirect chain initiated by the portal click (SSO token exchange).
 */
async function openServiceViaPortal(portalPage: Page, onLog: (msg: string) => void): Promise<Page> {
  const newTab = await searchAndOpenService(
    portalPage,
    "Casas Particulares",
    "Personal de Casas Particulares",
    onLog,
  );

  await newTab.waitForLoadState("networkidle", { timeout: 30_000 });
  onLog(`URL del servicio: ${newTab.url()}`);

  if (await isSessionExpiredPage(newTab)) {
    throw new Error("No se pudo acceder a Personal de Casas Particulares — la sesion expiro");
  }

  return newTab;
}

/**
 * Pull only worker data from "Personal de Casas Particulares" (no receipts).
 * Used by "Importar desde ARCA" on the Perfil Impositivo page.
 */
export async function pullDomesticWorkersOnly(
  page: Page,
  onLog: (msg: string) => void,
): Promise<DomesticWorkerData[]> {
  const result = await pullDomesticInternal(page, null, onLog);
  return result.workers;
}

/**
 * Pull receipts from "Personal de Casas Particulares" for workers already saved in the DB.
 * Used by "Importar desde ARCA" on the Recibos page.
 *
 * Instead of iterating all workers on the ARCA page, this function receives a list
 * of worker CUILs from the DB and only navigates to "PAGOS Y RECIBOS" for those workers.
 * This avoids pulling worker data (already done via Perfil Impositivo) and limits
 * the scope to only the workers the user cares about.
 */
export async function pullDomesticReceipts(
  page: Page,
  workerCuils: string[],
  fiscalYear: number,
  onLog: (msg: string) => void,
): Promise<DomesticReceiptData[]> {
  const receipts: DomesticReceiptData[] = [];

  if (workerCuils.length === 0) {
    onLog("No hay trabajadores registrados — importa trabajadores primero desde Perfil Impositivo");
    return receipts;
  }

  const servicePage = await openServiceViaPortal(page, onLog);

  const homeUrl = servicePage.url();

  // Build a set for fast lookup
  const cuilSet = new Set(workerCuils.map((c) => c.replace(/-/g, "")));
  onLog(`Buscando recibos para ${cuilSet.size} trabajador(es): ${workerCuils.join(", ")}`);

  // Find all "PAGOS Y RECIBOS" links — they appear in order matching the worker cards
  // We need to match each link to a worker by reading the CUIL from the card above it
  const pageText = await servicePage.locator("body").innerText();

  // Parse the home page to find which index corresponds to which CUIL
  // The page shows cards like: "PAREDES FRETES ZULLY SOFIA\nCUIL: 27-94689765-0\n..."
  // followed by action buttons including "PAGOS Y RECIBOS"
  const pagosLinks = await servicePage.locator("a:has-text('PAGOS Y RECIBOS')").all();
  const cuilMatches = [...pageText.matchAll(/CUIL:\s*([\d-]+)/g)];

  onLog(`Encontrados ${pagosLinks.length} trabajadores en ARCA, ${cuilMatches.length} CUILs`);

  for (let i = 0; i < Math.min(pagosLinks.length, cuilMatches.length); i++) {
    const rawCuil = cuilMatches[i][1].replace(/-/g, "");

    if (!cuilSet.has(rawCuil)) {
      onLog(`Saltando trabajador CUIL ${cuilMatches[i][1]} (no esta en tu lista)`);
      continue;
    }

    onLog(`--- Procesando recibos del trabajador CUIL ${cuilMatches[i][1]} ---`);

    // Re-fetch links (refs get stale after navigation)
    const currentPagosLinks = await servicePage.locator("a:has-text('PAGOS Y RECIBOS')").all();
    if (i >= currentPagosLinks.length) {
      onLog(`Link PAGOS Y RECIBOS #${i + 1} no encontrado, saltando...`);
      continue;
    }

    await currentPagosLinks[i].click();
    await servicePage.waitForLoadState("networkidle");

    if (await isSessionExpiredPage(servicePage)) {
      onLog("Sesion expirada — recuperando...");
      await servicePage.goto(homeUrl, { waitUntil: "networkidle" });
      continue;
    }

    const workerPageUrl = servicePage.url();

    const workerReceipts = await extractReceiptsFromTable(
      servicePage,
      rawCuil,
      workerPageUrl,
      fiscalYear,
      onLog,
    );
    receipts.push(...workerReceipts);

    // Go back to home
    onLog("Volviendo a la pagina principal...");
    await servicePage.goto(homeUrl, { waitUntil: "networkidle" });

    // Track which CUILs were processed
    cuilSet.delete(rawCuil);
  }

  // Check for remaining CUILs not found among active workers — look in historical
  if (cuilSet.size > 0) {
    onLog(
      `${cuilSet.size} trabajador(es) no encontrados en activos: ${[...cuilSet].join(", ")}. Buscando en historicos...`,
    );

    const historicReceipts = await pullHistoricWorkerReceipts(
      servicePage,
      homeUrl,
      cuilSet,
      fiscalYear,
      onLog,
    );
    receipts.push(...historicReceipts);
  }

  onLog(`Total: ${receipts.length} recibos importados`);
  return receipts;
}

/**
 * Navigate to "VER TRABAJADORES HISTÓRICOS" and return an array of
 * { cuil, href } entries paired by DOM position. Returns empty array
 * if the link doesn't exist (user has no terminated workers).
 *
 * Leaves the page on the historical workers list URL (returned as historicUrl).
 */
async function navigateToHistoricWorkersList(
  servicePage: Page,
  homeUrl: string,
  onLog: (msg: string) => void,
): Promise<{ entries: { cuil: string; href: string }[]; historicUrl: string } | null> {
  // Ensure we're on the home page first
  if (servicePage.url() !== homeUrl) {
    await servicePage.goto(homeUrl, { waitUntil: "networkidle" });
  }

  const historicLink = servicePage.locator("a:has-text('VER TRABAJADORES HISTÓRICOS')");
  if ((await historicLink.count()) === 0) {
    onLog("No se encontro el link VER TRABAJADORES HISTORICOS");
    return null;
  }

  await historicLink.click();
  await servicePage.waitForLoadState("networkidle");
  const historicUrl = servicePage.url();

  const entries = await servicePage.evaluate(() => {
    const body = document.body.textContent || "";
    const cuilMatches = [...body.matchAll(/CUIL:\s*([\d-]+)/g)];
    const datosLinks = document.querySelectorAll("a");
    const datosHrefs: string[] = [];
    for (let i = 0; i < datosLinks.length; i++) {
      if (datosLinks[i].textContent?.trim() === "DATOS DEL TRABAJADOR") {
        datosHrefs.push(datosLinks[i].href);
      }
    }
    const result: { cuil: string; href: string }[] = [];
    for (let i = 0; i < Math.min(cuilMatches.length, datosHrefs.length); i++) {
      result.push({ cuil: cuilMatches[i][1].replace(/-/g, ""), href: datosHrefs[i] });
    }
    return result;
  });

  onLog(`Encontrados ${entries.length} trabajadores historicos`);
  return { entries, historicUrl };
}

/**
 * Pull worker data (not receipts) from "VER TRABAJADORES HISTÓRICOS".
 * Used by pullDomesticInternal to include terminated workers in the import.
 */
async function pullHistoricWorkerData(
  servicePage: Page,
  homeUrl: string,
  onLog: (msg: string) => void,
): Promise<DomesticWorkerData[]> {
  const workers: DomesticWorkerData[] = [];

  const result = await navigateToHistoricWorkersList(servicePage, homeUrl, onLog);
  if (!result) return workers;

  const { entries, historicUrl } = result;

  for (const hw of entries) {
    onLog(`--- Procesando trabajador historico CUIL ${hw.cuil} ---`);

    await servicePage.goto(hw.href, { waitUntil: "networkidle" });

    if (await isSessionExpiredPage(servicePage)) {
      onLog("Sesion expirada — recuperando...");
      await servicePage.goto(historicUrl, { waitUntil: "networkidle" });
      continue;
    }

    const detailText = await servicePage.locator("body").innerText();
    const worker = extractWorkerFromDetailPage(detailText);

    if (worker) {
      workers.push(worker);
      onLog(
        `Trabajador historico: ${worker.apellidoNombre} (CUIL: ${worker.cuil}, ${worker.condicion})`,
      );
    }

    onLog("Volviendo a trabajadores historicos...");
    await servicePage.goto(historicUrl, { waitUntil: "networkidle" });
  }

  // Go back to home
  await servicePage.goto(homeUrl, { waitUntil: "networkidle" });

  return workers;
}

/**
 * Pull receipts for terminated workers from "VER TRABAJADORES HISTÓRICOS".
 *
 * Historical workers don't have a "PAGOS Y RECIBOS" link on the main page.
 * Instead we click "VER TRABAJADORES HISTÓRICOS", match CUILs to
 * "DATOS DEL TRABAJADOR" links, and navigate to VerTrabajador.aspx which
 * contains the same #PagosTable as active workers.
 */
async function pullHistoricWorkerReceipts(
  servicePage: Page,
  homeUrl: string,
  cuilSet: Set<string>,
  fiscalYear: number,
  onLog: (msg: string) => void,
): Promise<DomesticReceiptData[]> {
  const receipts: DomesticReceiptData[] = [];

  const result = await navigateToHistoricWorkersList(servicePage, homeUrl, onLog);
  if (!result) return receipts;

  const { entries: historicWorkers, historicUrl } = result;

  for (const hw of historicWorkers) {
    if (!cuilSet.has(hw.cuil)) continue;

    onLog(`--- Procesando recibos del trabajador historico CUIL ${hw.cuil} ---`);

    // Navigate directly to the worker detail page via its href
    await servicePage.goto(hw.href, { waitUntil: "networkidle" });

    if (await isSessionExpiredPage(servicePage)) {
      onLog("Sesion expirada — recuperando...");
      await servicePage.goto(historicUrl, { waitUntil: "networkidle" });
      continue;
    }

    const workerPageUrl = servicePage.url();

    const workerReceipts = await extractReceiptsFromTable(
      servicePage,
      hw.cuil,
      workerPageUrl,
      fiscalYear,
      onLog,
    );
    receipts.push(...workerReceipts);

    cuilSet.delete(hw.cuil);

    // Go back to historic workers page
    onLog("Volviendo a trabajadores historicos...");
    await servicePage.goto(historicUrl, { waitUntil: "networkidle" });
  }

  if (cuilSet.size > 0) {
    onLog(`Trabajadores no encontrados en activos ni historicos: ${[...cuilSet].join(", ")}`);
  }

  // Go back to home
  await servicePage.goto(homeUrl, { waitUntil: "networkidle" });

  return receipts;
}

/**
 * Internal: navigate to "Personal de Casas Particulares" and pull workers (always)
 * and optionally receipts (only when fiscalYear is provided).
 *
 * The `page` passed in should be on the ARCA portal (already logged in).
 * The service is opened by clicking through the portal to establish the SSO session.
 *
 * For navigation within the service:
 * - Uses explicit goto() to saved URLs (same domain, session preserved)
 * - NEVER uses page.goBack() (can land on the broken new domain)
 * - NEVER uses goto() to the base service URL directly (no SSO session)
 */
async function pullDomesticInternal(
  page: Page,
  fiscalYear: number | null,
  onLog: (msg: string) => void,
): Promise<PullDomesticResult> {
  const workers: DomesticWorkerData[] = [];
  const receipts: DomesticReceiptData[] = [];

  // Open the service via the portal click (establishes SSO session)
  const servicePage = await openServiceViaPortal(page, onLog);

  // Save the home URL — this is the service URL WITH the session, we can navigate to it
  const homeUrl = servicePage.url();

  // Find all "DATOS DEL TRABAJADOR" links to determine number of workers
  const datosLinks = await servicePage.locator("a:has-text('DATOS DEL TRABAJADOR')").all();
  const workerCount = datosLinks.length;
  onLog(`Encontrados ${workerCount} trabajadores a cargo`);

  for (let i = 0; i < workerCount; i++) {
    onLog(`--- Procesando trabajador ${i + 1} de ${workerCount} ---`);

    // Re-fetch links after each navigation (refs get stale)
    const currentDatosLinks = await servicePage.locator("a:has-text('DATOS DEL TRABAJADOR')").all();

    if (i >= currentDatosLinks.length) {
      onLog(`Trabajador ${i + 1} no encontrado, saltando...`);
      continue;
    }

    // Click "DATOS DEL TRABAJADOR"
    onLog("Navegando a datos del trabajador...");
    await currentDatosLinks[i].click();
    await servicePage.waitForLoadState("networkidle");

    if (await isSessionExpiredPage(servicePage)) {
      onLog("Sesion expirada al navegar — recuperando...");
      await servicePage.goto(homeUrl, { waitUntil: "networkidle" });
      const retryLinks = await servicePage.locator("a:has-text('DATOS DEL TRABAJADOR')").all();
      if (i < retryLinks.length) {
        await retryLinks[i].click();
        await servicePage.waitForLoadState("networkidle");
      } else {
        onLog(`Trabajador ${i + 1} no encontrado despues de recuperacion, saltando...`);
        continue;
      }
    }

    const workerDetailUrl = servicePage.url();

    // Extract worker data
    const detailText = await servicePage.locator("body").innerText();
    const worker = extractWorkerFromDetailPage(detailText);

    if (worker) {
      workers.push(worker);
      onLog(`Trabajador: ${worker.apellidoNombre} (CUIL: ${worker.cuil})`);
    }

    // Only process receipts if fiscalYear was requested
    if (fiscalYear !== null) {
      const pagosSection = servicePage.locator("text=Pagos y recibos");
      if ((await pagosSection.count()) > 0) {
        await pagosSection.scrollIntoViewIfNeeded();
        const workerReceipts = await extractReceiptsFromTable(
          servicePage,
          worker?.cuil ?? "",
          workerDetailUrl,
          fiscalYear,
          onLog,
        );
        receipts.push(...workerReceipts);
      }
    }

    // Go back to home
    onLog("Volviendo a la pagina principal...");
    await servicePage.goto(homeUrl, { waitUntil: "networkidle" });
  }

  const activeCount = workers.length;

  // Also pull historical workers (condicion: "Baja") from "VER TRABAJADORES HISTÓRICOS"
  const historicWorkers = await pullHistoricWorkerData(servicePage, homeUrl, onLog);
  workers.push(...historicWorkers);

  const historicCount = historicWorkers.length;
  onLog(
    fiscalYear !== null
      ? `Total: ${activeCount} activos, ${historicCount} historicos — ${workers.length} trabajadores, ${receipts.length} recibos`
      : `Total: ${activeCount} activos, ${historicCount} historicos — ${workers.length} trabajadores`,
  );
  return { workers, receipts };
}

function extractWorkerFromDetailPage(text: string): DomesticWorkerData | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let apellidoNombre = "";
  let cuil = "";
  let tipoTrabajo = "";
  let domicilioLaboral: string | null = null;
  let horasSemanales: string | null = null;
  let condicion = "Activo";
  let obraSocial: string | null = null;
  let fechaNacimiento: string | null = null;
  let fechaIngreso: string | null = null;
  let modalidadPago: string | null = null;
  let modalidadTrabajo: string | null = null;
  let remuneracionPactada: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("Detalle del trabajador")) {
      if (i + 1 < lines.length) {
        apellidoNombre = lines[i + 1];
      }
    }

    if (line.startsWith("CUIL:")) {
      cuil = line.replace("CUIL:", "").trim().replace(/-/g, "");
    }

    const tipoMatch = line.match(/Tipo de Trabajo \(categor[ií]a\):\s*(.+)/i);
    if (tipoMatch) tipoTrabajo = tipoMatch[1].trim();

    const domMatch = line.match(/Domicilio Laboral:\s*(.+)/i);
    if (domMatch) domicilioLaboral = domMatch[1].trim();

    const horasMatch = line.match(/Horas semanales:\s*(.+)/i);
    if (horasMatch) horasSemanales = horasMatch[1].trim();

    const condMatch = line.match(/Condici[oó]n:\s*(.+)/i);
    if (condMatch) condicion = condMatch[1].trim();

    const obraMatch = line.match(/Obra Social:\s*(.+)/i);
    if (obraMatch) obraSocial = obraMatch[1].trim();

    const fnacMatch = line.match(/Fecha de nacimiento:\s*(.+)/i);
    if (fnacMatch) fechaNacimiento = fnacMatch[1].trim();

    const fingMatch = line.match(/Fecha de (?:alta|ingreso):\s*(.+)/i);
    if (fingMatch) fechaIngreso = fingMatch[1].trim();

    const modPagoMatch = line.match(/Modalidad de pago:\s*(.+)/i);
    if (modPagoMatch) modalidadPago = modPagoMatch[1].trim();

    const modTrabMatch = line.match(/Modalidad de trabajo:\s*(.+)/i);
    if (modTrabMatch) modalidadTrabajo = modTrabMatch[1].trim();

    const remMatch = line.match(/Remuneraci[oó]n pactada:\s*\$?\s*([\d.,]+)/i);
    if (remMatch) remuneracionPactada = remMatch[1].replace(/\./g, "").replace(",", ".");
  }

  if (!cuil || cuil.length < 11) return null;

  return {
    cuil,
    apellidoNombre: apellidoNombre || "Sin nombre",
    tipoTrabajo: tipoTrabajo || "Personal para tareas generales",
    domicilioLaboral,
    horasSemanales,
    condicion,
    obraSocial,
    fechaNacimiento,
    fechaIngreso,
    modalidadPago,
    modalidadTrabajo,
    remuneracionPactada,
  };
}

/**
 * Extract receipts from the "Pagos y recibos" table (#PagosTable).
 *
 * IMPORTANT: The table uses client-side pagination — ALL rows are loaded in the DOM
 * at once, with only 4 visible per "page" (toggled via CSS display). Receipt rows
 * have class `f-w-400`; alternating `rowPago` rows are empty placeholders.
 *
 * We select ALL `tr.f-w-400` rows in a single pass — no pagination loop needed.
 *
 * For each matching row we download the receipt PDF (VER RECIBO triggers a download
 * without navigating away) and extract payment details by navigating to DetalleRup.aspx
 * then returning to the receipts page.
 */
async function extractReceiptsFromTable(
  page: Page,
  workerCuil: string,
  workerDetailUrl: string,
  fiscalYear: number,
  onLog: (msg: string) => void,
): Promise<DomesticReceiptData[]> {
  const receipts: DomesticReceiptData[] = [];

  // All receipt rows are in the DOM (client-side pagination); select only the
  // actual receipt rows (class f-w-400), ignoring the empty rowPago placeholders.
  //
  // IMPORTANT: We extract cell values via page.evaluate() reading the value <span>
  // directly (not .innerText()). Each <td> contains:
  //   <span class="td-label">Período</span><span id="...">Marzo 2026</span>
  // For hidden rows (client-side pagination hides via display:none), innerText
  // collapses the label and value without whitespace (e.g., "PeríodoMarzo 2026")
  // making parsePeriodo fail. Reading the value span's textContent avoids this.
  interface RawRowData {
    periodo: string;
    pago: string;
    sueldo: string;
    reciboUrl: string | null;
    detalleUrl: string | null;
  }
  const rawRows = await page.evaluate(() => {
    const rows = document.querySelectorAll("#PagosTable tbody tr.f-w-400");
    const result: {
      periodo: string;
      pago: string;
      sueldo: string;
      reciboUrl: string | null;
      detalleUrl: string | null;
    }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll("td");
      if (cells.length < 5) continue;
      // Read the value span (second span, skipping .td-label) from each cell
      const valSpan = (cell: Element) => {
        const span = cell.querySelector("span:not(.td-label)");
        return span ? (span.textContent?.trim() ?? "") : (cell.textContent?.trim() ?? "");
      };
      // Extract link URLs directly — rows may be hidden by client-side pagination
      // so we can't click them; we navigate to the URLs directly instead.
      const links = rows[i].querySelectorAll("a");
      let reciboUrl: string | null = null;
      let detalleUrl: string | null = null;
      for (let j = 0; j < links.length; j++) {
        const text = links[j].textContent?.trim() ?? "";
        if (text === "VER RECIBO" || text === "RECIBO") reciboUrl = links[j].href;
        if (text.includes("Detalle de pago") || text.includes("DETALLE DE PAGO"))
          detalleUrl = links[j].href;
      }
      result.push({
        periodo: valSpan(cells[0]),
        pago: valSpan(cells[1]),
        sueldo: valSpan(cells[3]),
        reciboUrl,
        detalleUrl,
      });
    }
    return result;
  });
  onLog(`${rawRows.length} recibos totales en la tabla`);

  // Filter rows matching the target fiscal year.
  // The table is ordered newest-first.
  interface RowData {
    periodoText: string;
    parsed: { month: number; year: number };
    pago: number;
    sueldo: number;
    reciboUrl: string | null;
    detalleUrl: string | null;
  }
  const matchingRows: RowData[] = [];

  for (const raw of rawRows) {
    const parsed = parsePeriodo(raw.periodo);
    if (!parsed) continue;

    if (parsed.year < fiscalYear) {
      // Table is newest-first — once we see an older year, all remaining are older too
      onLog(`Alcanzado año ${parsed.year} (< ${fiscalYear}) — deteniendo lectura de tabla`);
      break;
    }
    if (parsed.year > fiscalYear) continue;

    matchingRows.push({
      periodoText: raw.periodo,
      parsed,
      pago: parseAmount(raw.pago),
      sueldo: parseAmount(raw.sueldo),
      reciboUrl: raw.reciboUrl,
      detalleUrl: raw.detalleUrl,
    });
  }

  onLog(`${matchingRows.length} recibos del año ${fiscalYear}`);

  // Process matching rows: download PDFs via direct HTTP request and fetch
  // payment details via page.goto(). We use URLs extracted from the DOM rather
  // than clicking links because client-side pagination hides most rows
  // (display:none) and Playwright refuses to click invisible elements.
  for (const rd of matchingRows) {
    let pdfBuffer: Buffer | null = null;
    let pdfFilename: string | null = null;

    // Download receipt PDF via direct HTTP request (shares page cookies)
    if (rd.reciboUrl) {
      try {
        const response = await page.request.get(rd.reciboUrl);
        if (response.ok()) {
          pdfBuffer = Buffer.from(await response.body());
          pdfFilename = `recibo-${workerCuil}-${rd.parsed.month}-${rd.parsed.year}.pdf`;
          onLog(`Descargado recibo: ${pdfFilename} (${pdfBuffer.length} bytes)`);
        } else {
          onLog(`Error descargando recibo de ${rd.periodoText}: HTTP ${response.status()}`);
        }
      } catch {
        onLog(`No se pudo descargar el recibo de ${rd.periodoText}`);
      }
    }

    // Fetch payment details by navigating to the Detalle de pago URL directly
    const paymentDetails: Array<{ tipoPago: string; importe: number; fechaPago: string }> = [];

    if (rd.detalleUrl) {
      try {
        await page.goto(rd.detalleUrl, { waitUntil: "networkidle" });

        if (await isSessionExpiredPage(page)) {
          onLog(`Sesion expirada al ver detalle de pago de ${rd.periodoText} — saltando...`);
        } else {
          const detailRows = await page.locator("table tbody tr").all();
          for (const dRow of detailRows) {
            const dCells = await dRow.locator("td").all();
            if (dCells.length >= 5) {
              const tipoPago = (await dCells[2].innerText()).trim();
              const importe = parseAmount((await dCells[3].innerText()).trim());
              const fechaPago = (await dCells[4].innerText()).trim();
              if (tipoPago && importe > 0) {
                paymentDetails.push({ tipoPago, importe, fechaPago });
              }
            }
          }
        }

        // Navigate back to receipts page (NEVER page.goBack())
        await page.goto(workerDetailUrl, { waitUntil: "networkidle" });
      } catch {
        onLog(`No se pudo obtener detalle de pago de ${rd.periodoText}`);
        try {
          await page.goto(workerDetailUrl, { waitUntil: "networkidle" });
        } catch {
          // Best effort
        }
      }
    }

    receipts.push({
      workerCuil,
      periodo: rd.periodoText.split("\n")[0].trim(),
      fiscalYear: rd.parsed.year,
      fiscalMonth: rd.parsed.month,
      pago: rd.pago,
      sueldo: rd.sueldo,
      pdfBuffer,
      pdfFilename,
      paymentDetails,
    });
  }

  return receipts;
}
