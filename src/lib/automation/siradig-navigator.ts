import { Page } from "playwright";
import {
  getSiradigCategoryText,
  getSiradigInvoiceTypeText,
  getSiradigCategoryLinkId,
  getAlquilerLinkId,
  isAlquilerCategory,
  isEducationCategory,
  isIndumentariaTrabajoCategory,
  isSchoolProvider,
} from "./deduction-mapper";
import { ARCA_SELECTORS } from "./selectors";
import type { ScreenshotCallback } from "./arca-navigator";

export interface InvoiceData {
  deductionCategory: string;
  providerCuit: string;
  invoiceType: string;
  invoiceNumber?: string; // "XXXXX-YYYYYYYY" (punto de venta - número)
  invoiceDate?: string; // ISO date string
  amount: string;
  fiscalMonth: number;
  // For ALQUILER_VIVIENDA: lease contract validity period
  contractStartDate?: string; // ISO date string
  contractEndDate?: string; // ISO date string
  // User preference: affects which alquiler benefit applies
  ownsProperty?: boolean; // true = 10% (Art. 85 inc. k), false = 40% (Art. 85 inc. h)
  // For GASTOS_EDUCATIVOS: linked family dependent
  familyDependent?: {
    numeroDoc: string;
    apellido: string;
    nombre: string;
  };
}

export interface FillResult {
  success: boolean;
  error?: string;
  screenshotBuffer?: Buffer;
}

/**
 * Format an ISO date string to DD/MM/YYYY for SiRADIG date fields.
 */
function formatDateDDMMYYYY(isoDate: string): string {
  const date = new Date(isoDate);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Navigate through SiRADIG from the initial person selection page
 * all the way to the deductions section of the F572 form.
 *
 * Steps (matching the ARCA/SiRADIG UI flow):
 * 2. Select person to represent
 * 3. Select fiscal period and click "Continuar"
 * 4. Create new draft ("Crear Nuevo Borrador") or skip if exists
 * 5. Click "Carga de Formulario"
 * 6. Expand "3 - Deducciones y desgravaciones" accordion
 */
export async function navigateToDeductionSection(
  page: Page,
  fiscalYear: number,
  onLog?: (msg: string) => void,
  onScreenshot?: ScreenshotCallback,
): Promise<FillResult> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});

  try {
    // Step 2: Select person to represent
    log(`Seleccionando persona a representar... (URL: ${page.url()})`);
    await page.waitForLoadState("networkidle");

    // The person selection page uses <input type="button" class="btn_empresa">
    // elements with the person name in the value attribute
    const personButton = page.locator("input.btn_empresa").first();
    await personButton.waitFor({ timeout: 30000 });
    await personButton.click();
    await page.waitForLoadState("networkidle");
    log(`Persona seleccionada. URL: ${page.url()}`);

    await capture(
      await page.screenshot({ fullPage: true }),
      "person-selected",
      "Persona seleccionada",
    );

    // Step 3: Select fiscal period and click "Continuar"
    log(`Seleccionando periodo fiscal ${fiscalYear}...`);

    // Wait for the period selection page with a <select> dropdown
    const periodSelect = page.locator("select").first();
    await periodSelect.waitFor({ timeout: 30000 });
    await periodSelect.selectOption(String(fiscalYear));

    await capture(
      await page.screenshot({ fullPage: true }),
      "period-selected",
      `Periodo ${fiscalYear} seleccionado`,
    );

    // Click "Continuar"
    log("Haciendo click en Continuar...");
    const continueBtn = page.getByText("Continuar").first();
    await continueBtn.click();
    await page.waitForLoadState("networkidle");
    log(`Despues de Continuar. URL: ${page.url()}`);

    await capture(
      await page.screenshot({ fullPage: true }),
      "after-continue",
      "Pagina principal SiRADIG",
    );

    // Dismiss the "Recordatorio - Formulario Borrador" modal if it appears
    try {
      const aceptarBtn = page.getByText("Aceptar", { exact: true }).first();
      await aceptarBtn.waitFor({ timeout: 3000 });
      log("Cerrando recordatorio de formulario borrador...");
      await aceptarBtn.click();
      await page.waitForTimeout(500);
    } catch {
      // Modal didn't appear, continue normally
    }

    // Step 4: Create new draft if needed, or skip if draft already exists
    // When a draft exists, #btn_nuevo_borrador is hidden (display:none)
    // and the menu items are already visible
    const createDraftBtn = page.locator("#btn_nuevo_borrador");
    if (await createDraftBtn.isVisible()) {
      log("Creando nuevo borrador...");
      await createDraftBtn.click();
      // Clicking triggers slideDown animations for menu items (up to 1500ms)
      await page.waitForTimeout(2000);
    } else {
      log("Borrador existente detectado, continuando...");
    }

    await capture(await page.screenshot({ fullPage: true }), "draft-menu", "Menu del borrador");

    // Step 5: Click "Carga de Formulario" (#btn_carga)
    // This button uses a jQuery click handler that navigates via
    // document.location.href after a 400ms delay
    log("Accediendo a Carga de Formulario...");
    const formLoadBtn = page.locator("#btn_carga");
    await formLoadBtn.waitFor({ state: "visible", timeout: 30000 });
    await formLoadBtn.click();
    await page.waitForLoadState("networkidle");
    log(`Formulario cargado. URL: ${page.url()}`);

    await capture(
      await page.screenshot({ fullPage: true }),
      "form-loaded",
      "Formulario F572 Web cargado",
    );

    // Step 6: Expand "3 - Deducciones y desgravaciones" accordion section
    log("Expandiendo seccion de Deducciones y desgravaciones...");
    const deductionsSection = page.getByText("Deducciones y desgravaciones").first();
    await deductionsSection.waitFor({ timeout: 30000 });
    await deductionsSection.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000); // Wait for accordion animation

    await capture(
      await page.screenshot({ fullPage: true }),
      "deductions-section",
      "Seccion de deducciones expandida",
    );

    log("Navegacion a seccion de deducciones completada");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error navegando dentro de SiRADIG: ${msg} | URL: ${page.url()}`);
    try {
      await capture(
        await page.screenshot({ fullPage: true }),
        "navigation-error",
        "Error de navegacion en SiRADIG",
      );
    } catch {
      /* screenshot may fail too */
    }
    return { success: false, error: msg };
  }
}

/**
 * Fill the "Beneficios para Locatarios (Inquilinos) - 40%" form in SiRADIG.
 * This form has a completely different structure from other deduction forms:
 * - Locador CUIT + optional second landlord + optional inmobiliaria
 * - Contract validity dates (Vigencia del Contrato)
 * - "No titular de inmueble" declaration checkbox
 * - Monthly detail rows + per-row comprobante upload
 */
async function fillAlquilerLocatarioForm(
  page: Page,
  invoice: InvoiceData,
  log: (msg: string) => void,
  capture: (buffer: Buffer, slug: string, label: string) => Promise<void>,
): Promise<void> {
  // Wait for form to be ready (CUIT + razonSocial already filled by the common flow)
  await page.waitForTimeout(500);
  await page.locator("#locadorAdicional").waitFor({ state: "visible", timeout: 10000 });

  // Locador Adicional: No — use jQuery to trigger its change handler
  log("Seleccionando Locador Adicional: No");
  await page.evaluate(() => {
    (window as any).$("#locadorAdicional").val("N").trigger("change");
  });
  await page.waitForTimeout(800);

  // Inmobiliaria: No — use jQuery to trigger its change handler
  log("Seleccionando Inmobiliaria: No");
  await page.evaluate(() => {
    (window as any).$("#inmobiliaria").val("N").trigger("change");
  });
  await page.waitForTimeout(800);

  // Contract validity dates — use jQuery to set value + trigger for jQuery UI datepicker
  if (invoice.contractStartDate) {
    const startStr = formatDateDDMMYYYY(invoice.contractStartDate);
    log(`Ingresando fecha de inicio del contrato: ${startStr}`);
    await page.evaluate((d: string) => {
      (window as any).$("#fechaVigenciaDesde").val(d).trigger("change");
    }, startStr);
    await page.waitForTimeout(300);
  } else {
    log("ADVERTENCIA: Fecha de inicio del contrato no disponible — completar manualmente");
  }

  if (invoice.contractEndDate) {
    const endStr = formatDateDDMMYYYY(invoice.contractEndDate);
    log(`Ingresando fecha de fin del contrato: ${endStr}`);
    await page.evaluate((d: string) => {
      (window as any).$("#fechaVigenciaHasta").val(d).trigger("change");
    }, endStr);
    await page.waitForTimeout(300);
  } else {
    log("ADVERTENCIA: Fecha de fin del contrato no disponible — completar manualmente");
  }

  // Check "no titular de inmueble" declaration — only for non-property-owners (40% form)
  if (!invoice.ownsProperty) {
    log("Marcando declaracion de no titular de inmueble");
    await page.evaluate(() => {
      const $cb = (window as any).$("#noTitular");
      if (!$cb.prop("checked")) {
        $cb.trigger("click");
      }
    });
    await page.waitForTimeout(300);
  }

  await capture(
    await page.screenshot({ fullPage: true }),
    "alquiler-header-filled",
    "Datos del locador y contrato completados",
  );

  // Open "Agregar Mes Individual" dialog — use jQuery trigger to open the dialog
  log("Agregando mes individual...");
  await page.evaluate(() => {
    (window as any).$("#btn_alta_mes").trigger("click");
  });
  await page.waitForTimeout(1000);

  // Select month and fill rent amount
  const monthValue = String(invoice.fiscalMonth);
  log(`Seleccionando mes: ${monthValue}`);
  await page.evaluate((v: string) => {
    (window as any).$("#detalleIndividualMes").val(v).trigger("change");
  }, monthValue);
  await page.waitForTimeout(300);

  // Type amount character-by-character so jQuery Validate marks the field as touched,
  // then Tab away to trigger blur → Monto Tope auto-calculation
  log(`Ingresando monto de alquiler: $${invoice.amount}`);
  const montoField = page.locator("#detalleIndividualMontoRealMensual");
  await montoField.click();
  await montoField.fill(""); // clear any previous value
  await montoField.pressSequentially(invoice.amount, { delay: 30 });
  await montoField.press("Tab"); // Tab to next field triggers blur → Monto Tope calculation
  await page.waitForTimeout(800);

  await capture(
    await page.screenshot({ fullPage: true }),
    "alquiler-mes-dialog",
    "Dialogo de mes individual completado",
  );

  // Click "Agregar" in the mes dialog
  // Use filter({ has }) instead of `:visible` which is jQuery-only, not valid CSS for Playwright
  log("Confirmando mes individual...");
  const mesDialog = page.locator(".ui-dialog").filter({ has: page.locator("#dialog_alta_mes") });
  const mesAgregarBtn = mesDialog.locator(".ui-dialog-buttonset button").first();
  await mesAgregarBtn.waitFor({ state: "visible", timeout: 5000 });
  await mesAgregarBtn.click();
  await page.waitForTimeout(1500);

  await capture(
    await page.screenshot({ fullPage: true }),
    "alquiler-mes-added",
    "Mes individual agregado",
  );

  // Add comprobante — non-fatal: if this fails, we still proceed to Guardar
  try {
    log("Abriendo dialogo de comprobante para el mes...");
    const lastMesRow = page.locator("#tabla_meses tbody tr").last();
    const cmpCellLink = lastMesRow.locator("td").nth(3).locator("a, button").first();

    const cmpOpened = await cmpCellLink.isVisible().catch(() => false);
    if (cmpOpened) {
      await cmpCellLink.click();
    } else {
      log("Usando boton global de alta de comprobante...");
      await page.locator("#btn_alta_comprobante").click();
    }
    await page.waitForTimeout(1000);

    await capture(
      await page.screenshot({ fullPage: true }),
      "alquiler-cmp-dialog",
      "Dialogo de comprobante abierto",
    );

    // Fill comprobante fields via jQuery to trigger form handlers
    if (invoice.invoiceDate) {
      const dateStr = formatDateDDMMYYYY(invoice.invoiceDate);
      log(`Ingresando fecha del comprobante: ${dateStr}`);
      await page.evaluate((d: string) => {
        (window as any).$("#cmpFechaEmision").val(d).trigger("change");
      }, dateStr);
      await page.waitForTimeout(300);
    }

    const invoiceTypeText = getSiradigInvoiceTypeText(invoice.invoiceType);
    log(`Seleccionando tipo: ${invoiceTypeText}`);
    await page.evaluate((label: string) => {
      const $sel = (window as any).$("#cmpTipo");
      const $opt = $sel.find("option").filter(function (this: HTMLOptionElement) {
        return (window as any).$(this).text().trim() === label;
      });
      if ($opt.length > 0) {
        $sel.val($opt.val()).trigger("change");
      }
    }, invoiceTypeText);
    await page.waitForTimeout(300);

    if (invoice.invoiceNumber) {
      const parts = invoice.invoiceNumber.split("-");
      if (parts.length === 2) {
        log(`Ingresando numero de comprobante: ${invoice.invoiceNumber}`);
        await page.evaluate(
          ([pv, num]: string[]) => {
            (window as any).$("#cmpPuntoVenta").val(pv).trigger("change");
            (window as any).$("#cmpNumero").val(num).trigger("change");
          },
          [parts[0], parts[1]],
        );
      } else {
        await page.evaluate((num: string) => {
          (window as any).$("#cmpNumero").val(num).trigger("change");
        }, invoice.invoiceNumber);
      }
      await page.waitForTimeout(300);
    }

    log(`Ingresando monto: $${invoice.amount}`);
    await page.evaluate((v: string) => {
      (window as any).$("#cmpMontoFacturado").val(v).trigger("change");
    }, invoice.amount);

    await capture(
      await page.screenshot({ fullPage: true }),
      "alquiler-cmp-filled",
      "Comprobante completado",
    );

    // Click "Agregar" in the comprobante dialog
    log("Agregando comprobante...");
    const cmpDialog = page
      .locator(".ui-dialog")
      .filter({ has: page.locator("#dialog_alta_comprobante") });
    const cmpAgregarBtn = cmpDialog.locator(".ui-dialog-buttonset button").first();
    await cmpAgregarBtn.waitFor({ state: "visible", timeout: 5000 });
    await cmpAgregarBtn.click();
    await page.waitForTimeout(1500);
  } catch (err) {
    log(
      `Advertencia: no se pudo agregar el comprobante (${err instanceof Error ? err.message : err}). Continuando con Guardar...`,
    );
  }

  await capture(
    await page.screenshot({ fullPage: true }),
    "alquiler-form-done",
    "Formulario de alquiler completado",
  );
}

/**
 * Select a deduction category from the "Agregar Deducciones y Desgravaciones"
 * dropdown, then fill the deduction form including the comprobante dialog.
 *
 * Steps:
 * 7. Click "Agregar Deducciones y Desgravaciones" toggle
 * 8. Select the specific category link from the expanded dropdown
 * 9. Fill CUIT and wait for Denominación (AJAX lookup)
 * 10. Select Período (month)
 * 11. Click "Alta de Comprobante" to open dialog
 * 12. Fill comprobante fields (fecha, tipo, número, monto, monto reintegrado)
 * 13. Click "Agregar" in dialog to add the comprobante
 */
export async function fillDeductionForm(
  page: Page,
  invoice: InvoiceData,
  onLog?: (msg: string) => void,
  onScreenshot?: ScreenshotCallback,
): Promise<FillResult> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});

  try {
    const categoryText = getSiradigCategoryText(invoice.deductionCategory);
    const cuitDigits = invoice.providerCuit.replace(/-/g, "");
    const monthNames = [
      "",
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    const monthName = monthNames[invoice.fiscalMonth] || "";

    // Check for an existing entry in the deductions table matching
    // category, CUIT, and period — if found, edit it instead of creating new.
    // Structure: #div_tabla_deducciones_agrupadas > fieldset > legend (category)
    //            > div > table > tbody > tr (CUIT | Denominación | Período | ...)
    log(
      `Buscando deduccion existente para ${categoryText} / CUIT ${invoice.providerCuit} / ${monthName}...`,
    );
    const categoryLower = categoryText.toLowerCase();
    const fieldsets = page.locator("#div_tabla_deducciones_agrupadas fieldset.grupo_deducciones");

    let foundExisting = false;
    const fieldsetCount = await fieldsets.count();
    for (let f = 0; f < fieldsetCount && !foundExisting; f++) {
      const fieldset = fieldsets.nth(f);
      const legendText = (await fieldset.locator("legend").textContent()) ?? "";

      // Case-insensitive category match
      if (!legendText.toLowerCase().includes(categoryLower)) continue;

      // Search rows within this fieldset for matching CUIT and period
      const rows = fieldset.locator("tbody tr");
      const rowCount = await rows.count();
      for (let r = 0; r < rowCount; r++) {
        const row = rows.nth(r);
        const rowText = (await row.textContent()) ?? "";
        const normalizedRow = rowText.replace(/-/g, "");

        if (normalizedRow.includes(cuitDigits) && rowText.includes(monthName)) {
          log(
            `Deduccion existente encontrada para CUIT ${invoice.providerCuit}, periodo ${monthName}. Editando...`,
          );
          const editBtn = row.locator(".act_editar");
          await editBtn.click();
          await page.waitForLoadState("networkidle");

          await capture(
            await page.screenshot({ fullPage: true }),
            "existing-entry-edit",
            "Editando deduccion existente",
          );
          foundExisting = true;
          break;
        }
      }
    }

    if (!foundExisting) {
      // Step 7: Click "Agregar Deducciones y Desgravaciones" dropdown toggle
      log("Abriendo menu de tipos de deduccion...");
      const addDeductionToggle = page.locator("#btn_agregar_deducciones");
      await addDeductionToggle.waitFor({ state: "visible", timeout: 15000 });
      await addDeductionToggle.click();
      await page.waitForTimeout(1500); // Wait for slideDown animation

      await capture(
        await page.screenshot({ fullPage: true }),
        "add-deduction-menu",
        "Menu de tipos de deduccion abierto",
      );

      // Step 8: Select the specific deduction category by its link ID
      // For ALQUILER_VIVIENDA, pick the right sub-category based on user ownership
      let linkId = getSiradigCategoryLinkId(invoice.deductionCategory);
      if (invoice.deductionCategory === "ALQUILER_VIVIENDA") {
        linkId = getAlquilerLinkId(invoice.ownsProperty ?? false);
        log(
          invoice.ownsProperty
            ? "Usando Beneficio 10% (Art. 85 inc. k) — titular de inmueble"
            : "Usando Beneficio 40% inquilinos (Art. 85 inc. h) — no propietario",
        );
      }
      log(`Seleccionando categoria: ${categoryText}`);

      if (linkId) {
        // For alquiler categories, expand the hidden sub-menu first
        if (isAlquilerCategory(linkId)) {
          log("Expandiendo sub-menu de alquiler de inmuebles...");
          await page.locator("#link_menu_alquiler_inmuebles").click();
          await page.waitForTimeout(1000);
        }

        const categoryLink = page.locator(`#${linkId}`);
        await categoryLink.waitFor({ state: "visible", timeout: 10000 });
        await categoryLink.click();
      } else {
        // Fallback: search within the dropdown menu only
        const categoryLink = page
          .locator("#menu_deducciones")
          .getByText(categoryText, { exact: false })
          .first();
        await categoryLink.waitFor({ timeout: 10000 });
        await categoryLink.click();
      }
      await page.waitForLoadState("networkidle");

      await capture(
        await page.screenshot({ fullPage: true }),
        "category-selected",
        `Categoria: ${categoryText}`,
      );

      // Step 9: Fill CUIT (#numeroDoc) and wait for Denominación (#razonSocial)
      log(`Ingresando CUIT del proveedor: ${invoice.providerCuit}`);
      await page.fill("#numeroDoc", invoice.providerCuit);
      // Trigger change event to fetch provider name via AJAX
      await page.locator("#numeroDoc").dispatchEvent("change");

      // Wait for Denominación to be populated
      log("Esperando denominacion del proveedor...");
      try {
        await page.waitForFunction(
          () => {
            const el = document.getElementById("razonSocial") as HTMLInputElement;
            return el && el.value.trim() !== "";
          },
          { timeout: 10000 },
        );
      } catch {
        log("No se pudo obtener la denominacion automaticamente");
      }

      await capture(
        await page.screenshot({ fullPage: true }),
        "cuit-filled",
        "CUIT ingresado y denominacion obtenida",
      );

      // Indumentaria/Equipamiento-specific: always select "Equipamiento" (#idConcepto value 2)
      if (isIndumentariaTrabajoCategory(invoice.deductionCategory)) {
        log("Seleccionando concepto: Equipamiento");
        await page.selectOption("#idConcepto", "2");
      }

      // Education-specific: Select "Tipo de Gasto" based on provider denomination
      if (isEducationCategory(invoice.deductionCategory)) {
        const razonSocial = await page
          .$eval("#razonSocial", (el) => (el as HTMLInputElement).value)
          .catch(() => "");

        const tipoGasto = isSchoolProvider(razonSocial) ? "1" : "2";
        const tipoLabel =
          tipoGasto === "1" ? "Servicios con fines educativos" : "Herramientas educativas";
        log(`Seleccionando tipo de gasto: ${tipoLabel}`);
        await page.selectOption("#idTipoGasto", tipoGasto);
      }

      // Step 10: Select Período (month) from #mesDesde
      // Skip for ALQUILER_VIVIENDA — that form uses #btn_alta_mes instead
      const monthValue = String(invoice.fiscalMonth);
      if (invoice.deductionCategory !== "ALQUILER_VIVIENDA") {
        log(`Seleccionando periodo: ${monthName || monthValue}`);
        await page.selectOption("#mesDesde", monthValue);
      }

      // Education-specific: Select Familiar from dialog
      // Must happen AFTER period selection because #mesDesde change clears familiar
      if (isEducationCategory(invoice.deductionCategory)) {
        if (!invoice.familyDependent) {
          return {
            success: false,
            error:
              "Factura educativa sin familiar vinculado. Vincula un familiar en desgrava.ar antes de enviar.",
          };
        }

        log(
          `Seleccionando familiar: ${invoice.familyDependent.apellido} ${invoice.familyDependent.nombre}...`,
        );
        await page.locator("#btn_seleccion_familiar").click();
        await page.waitForTimeout(1000); // Wait for dialog animation

        // Find the matching row in the Carga de Familia table by document number or name
        const rows = page.locator("#tabla_cargas_familia tbody tr");
        await rows.first().waitFor({ timeout: 5000 });
        const rowCount = await rows.count();
        let matchedRowIndex = -1;

        const targetDoc = invoice.familyDependent.numeroDoc.replace(/\D/g, "");
        const targetName =
          `${invoice.familyDependent.apellido} ${invoice.familyDependent.nombre}`.toLowerCase();

        for (let i = 0; i < rowCount; i++) {
          const rowText = (await rows.nth(i).textContent()) ?? "";
          const normalizedRow = rowText.replace(/\s+/g, " ").toLowerCase();
          // Match by document number (most reliable)
          if (targetDoc && normalizedRow.includes(targetDoc)) {
            matchedRowIndex = i;
            break;
          }
          // Fallback: match by full name
          if (normalizedRow.includes(targetName)) {
            matchedRowIndex = i;
            break;
          }
        }

        if (matchedRowIndex === -1) {
          await capture(
            await page.screenshot({ fullPage: true }),
            "familiar-not-found",
            "Familiar no encontrado en SiRADIG",
          );
          return {
            success: false,
            error: `Familiar "${invoice.familyDependent.apellido} ${invoice.familyDependent.nombre}" no encontrado en la tabla de Cargas de Familia de SiRADIG`,
          };
        }

        log(`Familiar encontrado en fila ${matchedRowIndex + 1} de ${rowCount}`);
        await rows.nth(matchedRowIndex).locator("td").first().click();
        await page.waitForTimeout(500);

        // Click "Aceptar" in the familiar selection dialog
        const dialogParent = page.locator("#dialog_seleccion_familiar").locator("..");
        await dialogParent.locator(".ui-dialog-buttonset button").first().click();
        await page.waitForTimeout(500);

        await capture(
          await page.screenshot({ fullPage: true }),
          "familiar-selected",
          "Familiar seleccionado",
        );
      }
    }

    // ALQUILER_VIVIENDA uses a completely different form structure
    if (invoice.deductionCategory === "ALQUILER_VIVIENDA") {
      await fillAlquilerLocatarioForm(page, invoice, log, capture);
      const screenshotBuffer = await page.screenshot({ fullPage: true });
      return { success: true, screenshotBuffer };
    }

    // Step 11: Click "Alta de Comprobante" to open the dialog
    log("Abriendo formulario de alta de comprobante...");
    const altaBtn = page.locator("#btn_alta_comprobante");
    await altaBtn.waitFor({ state: "visible", timeout: 15000 });
    await altaBtn.click();
    await page.waitForTimeout(1000); // Wait for dialog animation

    await capture(
      await page.screenshot({ fullPage: true }),
      "comprobante-dialog",
      "Dialogo de alta de comprobante",
    );

    // Step 12: Fill the comprobante dialog fields

    // Fecha (DD/MM/YYYY format)
    if (invoice.invoiceDate) {
      const dateStr = formatDateDDMMYYYY(invoice.invoiceDate);
      log(`Ingresando fecha: ${dateStr}`);
      await page.fill("#cmpFechaEmision", dateStr);
    }

    // Tipo (select by label from #cmpTipo)
    const invoiceTypeText = getSiradigInvoiceTypeText(invoice.invoiceType);
    log(`Seleccionando tipo de comprobante: ${invoiceTypeText}`);
    try {
      await page.selectOption("#cmpTipo", { label: invoiceTypeText });
    } catch {
      log(`Tipo "${invoiceTypeText}" no disponible, manteniendo valor por defecto`);
    }

    // Número de Comprobante (split "XXXXX-YYYYYYYY" into punto de venta + número)
    if (invoice.invoiceNumber) {
      const parts = invoice.invoiceNumber.split("-");
      if (parts.length === 2) {
        log(`Ingresando numero de comprobante: ${invoice.invoiceNumber}`);
        await page.fill("#cmpPuntoVenta", parts[0]);
        await page.fill("#cmpNumero", parts[1]);
      } else {
        log(`Ingresando numero de comprobante: ${invoice.invoiceNumber}`);
        await page.fill("#cmpNumero", invoice.invoiceNumber);
      }
    }

    // Monto
    log(`Ingresando monto: $${invoice.amount}`);
    await page.fill("#cmpMontoFacturado", invoice.amount);

    // Monto Reintegrado (set to 0 if the field exists)
    const montoReintegrado = await page.$("#cmpMontoReintegrado");
    if (montoReintegrado) {
      log("Ingresando monto reintegrado: $0");
      await page.fill("#cmpMontoReintegrado", "0");
    }

    await capture(
      await page.screenshot({ fullPage: true }),
      "comprobante-filled",
      "Comprobante completado",
    );

    // Step 13: Click "Agregar" button in the dialog to add the comprobante
    log("Agregando comprobante...");
    const agregarBtn = page.locator(".ui-dialog-buttonset").getByText("Agregar");
    await agregarBtn.click();
    await page.waitForTimeout(1500); // Wait for dialog to close and table update

    // Take final screenshot showing the form with the added comprobante
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    await capture(screenshotBuffer, "form-filled", "Formulario completado");

    log("Formulario completado con comprobante agregado. Esperando confirmacion.");
    return { success: true, screenshotBuffer };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error completando formulario: ${msg} | URL: ${page.url()}`);
    try {
      await capture(
        await page.screenshot({ fullPage: true }),
        "form-error",
        "Error al completar formulario",
      );
    } catch {
      /* screenshot may fail too */
    }
    return { success: false, error: msg };
  }
}

/**
 * Submit the deduction by clicking "Guardar" (#btn_guardar).
 */
export async function submitDeduction(
  page: Page,
  onLog?: (msg: string) => void,
  onScreenshot?: ScreenshotCallback,
): Promise<FillResult> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});

  try {
    log("Guardando deduccion...");
    const saveButton = page.locator("#btn_guardar");
    await saveButton.waitFor({ state: "visible", timeout: 15000 });
    await saveButton.click();

    // SiRADIG handlers often use setTimeout before AJAX calls,
    // so wait for the delayed request to fire and complete
    await page.waitForTimeout(500);
    await page.waitForLoadState("networkidle");

    await capture(await page.screenshot({ fullPage: true }), "after-save", "Guardando deduccion");

    // Poll for either an error or success indicator (up to 8 seconds)
    // .formErrorContent appears for validation/server errors
    // #div_listado appears when the save succeeds and the form switches to list view
    const outcome = await Promise.race([
      page
        .locator(".formErrorContent")
        .first()
        .waitFor({ state: "visible", timeout: 8000 })
        .then(() => "form-error" as const)
        .catch(() => null),
      page
        .locator("#div_listado")
        .first()
        .waitFor({ state: "visible", timeout: 8000 })
        .then(() => "success" as const)
        .catch(() => null),
    ]);

    if (outcome === "form-error") {
      // Collect ALL visible .formErrorContent texts
      const errorEls = await page.$$(".formErrorContent");
      const messages: string[] = [];
      for (const el of errorEls) {
        const text = await el.textContent();
        if (text?.trim()) messages.push(text.trim());
      }
      const errorMsg = messages.join(" | ") || "Error de validacion desconocido";
      await capture(
        await page.screenshot({ fullPage: true }),
        "submission-error",
        "Error al guardar",
      );
      log(`Error al guardar: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    if (outcome === "success") {
      await capture(
        await page.screenshot({ fullPage: true }),
        "submission-success",
        "Deduccion guardada exitosamente",
      );
      log("Deduccion guardada exitosamente");
      return { success: true };
    }

    // Neither appeared within timeout — check for other error indicators

    // Confirmation dialog (some flows show "Aceptar" before completing)
    try {
      const confirmButton = page.getByText("Aceptar", { exact: true }).first();
      await confirmButton.waitFor({ timeout: 3000 });
      log("Confirmando guardado...");
      await confirmButton.click();
      await page.waitForLoadState("networkidle");

      // After confirming, check again for errors
      const postConfirmError = await page
        .$(".formErrorContent")
        .then((el) => el?.textContent())
        .catch(() => null);
      if (postConfirmError?.trim()) {
        await capture(
          await page.screenshot({ fullPage: true }),
          "submission-error",
          "Error al guardar",
        );
        log(`Error al guardar: ${postConfirmError.trim()}`);
        return { success: false, error: postConfirmError.trim() };
      }
    } catch {
      // No confirmation dialog, continue
    }

    // Take a screenshot of whatever state we're in
    await capture(
      await page.screenshot({ fullPage: true }),
      "after-save-state",
      "Estado despues de guardar",
    );

    log("Deduccion procesada (sin confirmacion explicita)");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error guardando deduccion: ${msg} | URL: ${page.url()}`);
    try {
      await capture(
        await page.screenshot({ fullPage: true }),
        "submit-error",
        "Error guardando deduccion",
      );
    } catch {
      /* screenshot may fail too */
    }
    return { success: false, error: msg };
  }
}

// ── Cargas de Familia extraction ──────────────────────────────

/**
 * SiRADIG uses numeric codes for document types.
 * Maps the select option value to our FamilyDependent tipoDoc string.
 */
const SIRADIG_TIPO_DOC_MAP: Record<string, string> = {
  "80": "CUIT",
  "86": "CUIL",
  "87": "CDI",
  "96": "DNI",
  "89": "LC",
  "90": "LE",
};

export function mapSiradigTipoDoc(siradigValue: string): string {
  return SIRADIG_TIPO_DOC_MAP[siradigValue] ?? siradigValue;
}

export interface SiradigFamilyDependent {
  tipoDoc: string;
  numeroDoc: string;
  apellido: string;
  nombre: string;
  fechaNacimiento: string;
  parentesco: string;
  fechaUnion: string;
  porcentajeDed: string;
  cuitOtroDed: string;
  familiaCargo: boolean;
  residente: boolean;
  tieneIngresos: boolean;
  montoIngresos: string;
  mesDesde: number;
  mesHasta: number;
  proximosPeriodos: boolean;
}

/**
 * Reverse map: our tipoDoc strings → SiRADIG numeric option values.
 */
const TIPO_DOC_TO_SIRADIG: Record<string, string> = Object.fromEntries(
  Object.entries(SIRADIG_TIPO_DOC_MAP).map(([k, v]) => [v, k]),
);

export function mapTipoDocToSiradig(tipoDoc: string): string {
  return TIPO_DOC_TO_SIRADIG[tipoDoc] ?? tipoDoc;
}

/**
 * Filter out phantom/empty dependents that have no document number.
 */
export function filterValidDependents(
  dependents: SiradigFamilyDependent[],
): SiradigFamilyDependent[] {
  return dependents.filter((d) => d.numeroDoc && d.numeroDoc.trim().length > 0);
}

export interface ExtractCargasFamiliaResult {
  success: boolean;
  error?: string;
  dependents: SiradigFamilyDependent[];
}

/**
 * Navigate from the F572 form page to the "Cargas de Familia" section
 * by expanding the "1 - Detalles de las cargas de familia" accordion.
 *
 * Prerequisite: page must be on verMenuDeducciones.do (the F572 form page).
 */
export async function navigateToCargasFamilia(
  page: Page,
  onLog?: (msg: string) => void,
  onScreenshot?: ScreenshotCallback,
): Promise<FillResult> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});
  const sel = ARCA_SELECTORS.siradig.cargasFamilia;

  try {
    log("Expandiendo seccion de Cargas de Familia...");
    const accordionLink = page.locator(sel.accordionTab);

    // The accordion tab may use a link inside a heading — click the link text
    const tabLink = page.getByText("Detalles de las cargas de familia").first();
    const target = (await accordionLink.isVisible().catch(() => false)) ? accordionLink : tabLink;

    await target.waitFor({ timeout: 15000 });
    await target.click();
    await page.waitForTimeout(1500); // accordion animation

    await capture(
      await page.screenshot({ fullPage: true }),
      "cargas-familia-section",
      "Seccion de cargas de familia expandida",
    );

    // Verify the table container is visible
    const tableContainer = page.locator(sel.tableContainer);
    await tableContainer.waitFor({ state: "visible", timeout: 10000 });

    log("Seccion de cargas de familia abierta");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error abriendo seccion de cargas de familia: ${msg} | URL: ${page.url()}`);
    try {
      await capture(
        await page.screenshot({ fullPage: true }),
        "cargas-familia-error",
        "Error abriendo cargas de familia",
      );
    } catch {
      /* screenshot may fail too */
    }
    return { success: false, error: msg };
  }
}

/**
 * Extract all family dependents from SiRADIG by clicking the edit button
 * on each row, reading all form fields, then clicking "Volver".
 *
 * Prerequisite: the "Cargas de Familia" accordion must already be expanded
 * (call navigateToCargasFamilia first).
 */
export async function extractCargasFamilia(
  page: Page,
  onLog?: (msg: string) => void,
  onScreenshot?: ScreenshotCallback,
): Promise<ExtractCargasFamiliaResult> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});
  const sel = ARCA_SELECTORS.siradig.cargasFamilia;

  try {
    const rows = page.locator(sel.tableRows);
    const rowCount = await rows.count();

    if (rowCount === 0) {
      log("No se encontraron cargas de familia en SiRADIG");
      return { success: true, dependents: [] };
    }

    log(`Encontradas ${rowCount} cargas de familia. Extrayendo datos...`);
    const dependents: SiradigFamilyDependent[] = [];

    for (let i = 0; i < rowCount; i++) {
      log(`Leyendo carga de familia ${i + 1} de ${rowCount}...`);

      // Re-query rows each iteration since the DOM reloads after "Volver"
      const currentRows = page.locator(sel.tableRows);
      const editBtn = currentRows.nth(i).locator(sel.editButton);
      await editBtn.waitFor({ state: "visible", timeout: 10000 });
      await editBtn.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      // Read all form fields
      const data = await page.evaluate((selectors) => {
        const getSelectValue = (id: string) => {
          const el = document.querySelector(id) as HTMLSelectElement | null;
          return el?.value ?? "";
        };
        const getInputValue = (id: string) => {
          const el = document.querySelector(id) as HTMLInputElement | null;
          return el?.value ?? "";
        };
        const getCheckboxChecked = (id: string) => {
          const el = document.querySelector(id) as HTMLInputElement | null;
          return el?.checked ?? false;
        };

        return {
          tipoDoc: getSelectValue(selectors.formTipoDoc),
          numeroDoc: getInputValue(selectors.formNumeroDoc),
          apellido: getInputValue(selectors.formApellido),
          nombre: getInputValue(selectors.formNombre),
          fechaNacimiento: getInputValue(selectors.formFechaNacimiento),
          parentesco: getSelectValue(selectors.formParentesco),
          fechaCasamiento: getInputValue(selectors.formFechaCasamiento),
          porcentajeDed: getSelectValue(selectors.formPorcentajeDed),
          cuitOtroDed: getInputValue(selectors.formCuitOtroDed),
          familiaCargo: getSelectValue(selectors.formFamiliaCargo),
          residente: getSelectValue(selectors.formResidente),
          ingresos: getSelectValue(selectors.formIngresos),
          montoIngresos: getInputValue(selectors.formMontoIngresos),
          mesDesde: getSelectValue(selectors.formMesDesde),
          mesHasta: getSelectValue(selectors.formMesHasta),
          proximosPeriodos: getCheckboxChecked(selectors.formProximosPeriodos),
        };
      }, sel);

      await capture(
        await page.screenshot({ fullPage: true }),
        `carga-familia-${i + 1}`,
        `Carga de familia ${i + 1}: ${data.apellido}, ${data.nombre}`,
      );

      // Skip empty/phantom rows that have no document number
      if (!data.numeroDoc || !data.numeroDoc.trim()) {
        log(`Fila ${i + 1} sin numero de documento, saltando...`);
      } else {
        dependents.push({
          tipoDoc: mapSiradigTipoDoc(data.tipoDoc),
          numeroDoc: data.numeroDoc,
          apellido: data.apellido,
          nombre: data.nombre,
          fechaNacimiento: data.fechaNacimiento,
          parentesco: data.parentesco,
          fechaUnion: data.fechaCasamiento,
          porcentajeDed: data.porcentajeDed,
          cuitOtroDed: data.cuitOtroDed,
          familiaCargo: data.familiaCargo === "S",
          residente: data.residente === "S",
          tieneIngresos: data.ingresos === "S",
          montoIngresos: data.montoIngresos,
          mesDesde: parseInt(data.mesDesde, 10) || 1,
          mesHasta: parseInt(data.mesHasta, 10) || 12,
          proximosPeriodos: data.proximosPeriodos,
        });

        log(
          `Extraida: ${data.apellido}, ${data.nombre} (${mapSiradigTipoDoc(data.tipoDoc)} ${data.numeroDoc})`,
        );
      }

      // Go back to the table view
      const volverBtn = page.getByText("Volver", { exact: true }).first();
      await volverBtn.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
    }

    await capture(
      await page.screenshot({ fullPage: true }),
      "cargas-familia-extracted",
      `${dependents.length} cargas de familia extraidas`,
    );

    log(`Extraccion completada: ${dependents.length} cargas de familia`);
    return { success: true, dependents };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error extrayendo cargas de familia: ${msg} | URL: ${page.url()}`);
    try {
      await capture(
        await page.screenshot({ fullPage: true }),
        "extraction-error",
        "Error extrayendo cargas de familia",
      );
    } catch {
      /* screenshot may fail too */
    }
    return { success: false, error: msg, dependents: [] };
  }
}

// ── Push Cargas de Familia ──────────────────────────────────────

export interface PushFailedDependent {
  apellido: string;
  nombre: string;
  numeroDoc: string;
  error: string;
}

export interface PushCargasFamiliaResult {
  success: boolean;
  error?: string;
  created: number;
  updated: number;
  failed: PushFailedDependent[];
}

/**
 * Push local family dependents to SiRADIG by creating or updating rows
 * in the "Detalles de las cargas de familia" table.
 *
 * Prerequisite: the "Cargas de Familia" accordion must already be expanded
 * (call navigateToCargasFamilia first).
 */
export async function pushCargasFamilia(
  page: Page,
  dependents: SiradigFamilyDependent[],
  onLog?: (msg: string) => void,
  onScreenshot?: ScreenshotCallback,
): Promise<PushCargasFamiliaResult> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});
  const sel = ARCA_SELECTORS.siradig.cargasFamilia;

  let created = 0;
  let updated = 0;
  const failed: PushFailedDependent[] = [];

  try {
    // Step 1: Scan existing SiRADIG rows to build a documento → row-index map
    const existingRows = page.locator(sel.tableRows);
    const existingCount = await existingRows.count();
    const existingDocMap = new Map<string, number>();

    log(`Escaneando tabla existente (${existingCount} filas)...`);
    for (let i = 0; i < existingCount; i++) {
      const rowText = (await existingRows.nth(i).textContent()) ?? "";
      // Extract documento number from the row text (second column typically)
      const cells = existingRows.nth(i).locator("td");
      const cellCount = await cells.count();
      // The table typically has: Tipo Doc | Nro Doc | Apellido | Nombre | ...
      // Try to get the documento from the second cell
      if (cellCount >= 2) {
        const docText = ((await cells.nth(1).textContent()) ?? "").trim();
        if (docText) {
          existingDocMap.set(docText, i);
        }
      }
      // Also try matching the raw text in case table structure differs
      for (const dep of dependents) {
        if (
          dep.numeroDoc &&
          rowText.includes(dep.numeroDoc) &&
          !existingDocMap.has(dep.numeroDoc)
        ) {
          existingDocMap.set(dep.numeroDoc, i);
        }
      }
    }

    log(`Encontradas ${existingDocMap.size} cargas existentes en SiRADIG`);

    // Step 2: Process each local dependent
    for (let d = 0; d < dependents.length; d++) {
      const dep = dependents[d];
      if (!dep.numeroDoc || !dep.numeroDoc.trim()) continue;

      const isUpdate = existingDocMap.has(dep.numeroDoc);
      log(
        `${isUpdate ? "Actualizando" : "Creando"} carga ${d + 1}/${dependents.length}: ${dep.apellido}, ${dep.nombre} (${dep.numeroDoc})...`,
      );

      if (isUpdate) {
        // Click the edit button for the matching row
        const rowIndex = existingDocMap.get(dep.numeroDoc)!;
        const currentRows = page.locator(sel.tableRows);
        const editBtn = currentRows.nth(rowIndex).locator(sel.editButton);
        await editBtn.waitFor({ state: "visible", timeout: 10000 });
        await editBtn.click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(500);
      } else {
        // Click "Agregar" to create a new entry
        const agregarBtn = page.locator("#btn_alta_cargas_familia, #btn_agregar_carga_familia");
        // Fallback: look for any "Agregar" button within the cargas section
        const sectionAgregar = agregarBtn.or(
          page.locator(sel.sectionContainer).getByText("Agregar", { exact: false }).first(),
        );
        await sectionAgregar.first().waitFor({ state: "visible", timeout: 10000 });
        await sectionAgregar.first().click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(500);
      }

      // Step 3: Fill the form fields
      // Use page.evaluate with jQuery triggers for dropdowns (SiRADIG uses jQuery)
      await fillCargaFamiliaForm(page, dep, isUpdate, log);

      await capture(
        await page.screenshot({ fullPage: true }),
        `push-carga-${d + 1}`,
        `${isUpdate ? "Actualizada" : "Creada"}: ${dep.apellido}, ${dep.nombre}`,
      );

      // Step 4: Click "Guardar"
      log("Guardando...");
      const guardarBtn = page.locator("#btn_guardar");
      await guardarBtn.waitFor({ state: "visible", timeout: 10000 });
      await guardarBtn.click();

      // Wait for SiRADIG to process — handlers often use setTimeout before AJAX
      await page.waitForTimeout(500);
      await page.waitForLoadState("networkidle");
      // Extra wait for error tooltips/banners to render after AJAX completes
      await page.waitForTimeout(1000);

      // Check for errors after save — SiRADIG uses multiple error patterns:
      // 1. ".formErrorContent" for field-level validation errors
      // 2. ".ui-state-error" / ".error" for red banner/tooltip errors
      // 3. Text containing "Se detectaron errores" in a visible banner
      // 4. Tooltip-style popups with error messages (often "*" prefixed)
      const errorText = await page.evaluate(() => {
        const messages: string[] = [];

        // .formErrorContent elements
        document.querySelectorAll(".formErrorContent").forEach((el) => {
          const text = (el as HTMLElement).innerText?.trim();
          if (text) messages.push(text);
        });

        // .ui-state-error-text or .error-msg elements
        document
          .querySelectorAll(".ui-state-error-text, .error-msg, .mensaje-error, .alert-danger")
          .forEach((el) => {
            const text = (el as HTMLElement).innerText?.trim();
            if (text) messages.push(text);
          });

        // SiRADIG often shows errors in a qtip tooltip with class "qtip-content"
        document.querySelectorAll(".qtip-content").forEach((el) => {
          const text = (el as HTMLElement).innerText?.trim();
          if (text && text.startsWith("*")) messages.push(text);
        });

        // Check for the general error banner "Se detectaron errores en los datos enviados"
        const errorBanner = document.querySelector("#mensajeError, .mensajeError");
        if (errorBanner) {
          const text = (errorBanner as HTMLElement).innerText?.trim();
          if (text) messages.push(text);
        }

        // Deduplicate
        return [...new Set(messages)].join(" | ");
      });

      const hasError = errorText.length > 0;

      if (hasError) {
        const displayError = errorText || "Error de validacion desconocido";
        log(`Error al guardar ${dep.apellido}, ${dep.nombre}: ${displayError}`);
        failed.push({
          apellido: dep.apellido,
          nombre: dep.nombre,
          numeroDoc: dep.numeroDoc,
          error: displayError,
        });
        await capture(
          await page.screenshot({ fullPage: true }),
          `push-error-${d + 1}`,
          `Error guardando: ${dep.apellido}`,
        );
        // Try to go back to the table to continue with next dependent
        const volverBtn = page.getByText("Volver", { exact: true }).first();
        await volverBtn.click().catch(() => {});
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(1000);
        continue;
      }

      // Wait for the table to re-render
      await page.waitForTimeout(1500);

      if (isUpdate) {
        updated++;
      } else {
        created++;
      }

      log(`${isUpdate ? "Actualizada" : "Creada"} exitosamente: ${dep.apellido}, ${dep.nombre}`);

      // After creating a new entry, the existing row indices shift.
      // Re-scan the table to update indices for remaining dependents.
      if (!isUpdate) {
        const newRows = page.locator(sel.tableRows);
        const newCount = await newRows.count();
        existingDocMap.clear();
        for (let i = 0; i < newCount; i++) {
          const cells = newRows.nth(i).locator("td");
          const cellCount = await cells.count();
          if (cellCount >= 2) {
            const docText = ((await cells.nth(1).textContent()) ?? "").trim();
            if (docText) existingDocMap.set(docText, i);
          }
        }
      }
    }

    await capture(
      await page.screenshot({ fullPage: true }),
      "push-completed",
      `Exportacion completada: ${created} creadas, ${updated} actualizadas`,
    );

    const failedSummary = failed.length > 0 ? `, ${failed.length} con errores` : "";
    log(`Exportacion completada: ${created} creadas, ${updated} actualizadas${failedSummary}`);

    if (failed.length > 0) {
      log("Cargas con errores:");
      for (const f of failed) {
        log(`  - ${f.apellido}, ${f.nombre} (${f.numeroDoc}): ${f.error}`);
      }
    }

    return { success: true, created, updated, failed };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error exportando cargas de familia: ${msg} | URL: ${page.url()}`);
    try {
      await capture(
        await page.screenshot({ fullPage: true }),
        "push-error",
        "Error exportando cargas de familia",
      );
    } catch {
      /* screenshot may fail too */
    }
    return { success: false, error: msg, created, updated, failed };
  }
}

/**
 * Fill the cargas de familia edit/create form with dependent data.
 * Handles read-only fields gracefully by checking disabled/readonly state.
 */
async function fillCargaFamiliaForm(
  page: Page,
  dep: SiradigFamilyDependent,
  isUpdate: boolean,
  log: (msg: string) => void,
): Promise<void> {
  const siradigTipoDoc = mapTipoDocToSiradig(dep.tipoDoc);

  // Helper: set a select value via jQuery (SiRADIG uses jQuery for all form interactions)
  const setSelect = async (selector: string, value: string, label: string) => {
    const isDisabled = await page
      .locator(selector)
      .evaluate((el) => {
        const sel = el as HTMLSelectElement;
        return sel.disabled || sel.hasAttribute("readonly");
      })
      .catch(() => false);

    if (isDisabled) {
      log(`  Campo ${label} no editable, saltando...`);
      return;
    }

    await page.evaluate(
      ({ sel, val }: { sel: string; val: string }) => {
        (window as any).$(sel).val(val).trigger("change");
      },
      { sel: selector, val: value },
    );
    await page.waitForTimeout(300);
  };

  // Helper: set an input value via jQuery
  const setInput = async (selector: string, value: string, label: string) => {
    const isDisabled = await page
      .locator(selector)
      .evaluate((el) => {
        const inp = el as HTMLInputElement;
        return inp.disabled || inp.readOnly;
      })
      .catch(() => false);

    if (isDisabled) {
      log(`  Campo ${label} no editable, saltando...`);
      return;
    }

    await page.evaluate(
      ({ sel, val }: { sel: string; val: string }) => {
        (window as any).$(sel).val(val).trigger("change");
      },
      { sel: selector, val: value },
    );
    await page.waitForTimeout(200);
  };

  // Helper: set a checkbox via jQuery
  const setCheckbox = async (selector: string, checked: boolean, label: string) => {
    const isDisabled = await page
      .locator(selector)
      .evaluate((el) => (el as HTMLInputElement).disabled)
      .catch(() => false);

    if (isDisabled) {
      log(`  Campo ${label} no editable, saltando...`);
      return;
    }

    await page.evaluate(
      ({ sel, val }: { sel: string; val: boolean }) => {
        const $el = (window as any).$(sel);
        if ($el.prop("checked") !== val) {
          $el.prop("checked", val).trigger("change");
        }
      },
      { sel: selector, val: checked },
    );
    await page.waitForTimeout(200);
  };

  const sel = ARCA_SELECTORS.siradig.cargasFamilia;

  // Parentesco (must be set first as it may show/hide conditional fields)
  await setSelect(sel.formParentesco, dep.parentesco, "parentesco");
  await page.waitForTimeout(500); // Extra wait for conditional field visibility

  // Tipo documento + numero documento
  await setSelect(sel.formTipoDoc, siradigTipoDoc, "tipo documento");
  await setInput(sel.formNumeroDoc, dep.numeroDoc, "numero documento");

  // Apellido / Nombre
  await setInput(sel.formApellido, dep.apellido, "apellido");
  await setInput(sel.formNombre, dep.nombre, "nombre");

  // Fecha de nacimiento
  if (dep.fechaNacimiento) {
    await setInput(sel.formFechaNacimiento, dep.fechaNacimiento, "fecha nacimiento");
  }

  // Fecha de casamiento/union (conditional on parentesco 1 or 51)
  if (dep.fechaUnion) {
    await setInput(sel.formFechaCasamiento, dep.fechaUnion, "fecha union");
  }

  // Porcentaje deduccion (conditional on hijo parentescos)
  if (dep.porcentajeDed) {
    await setSelect(sel.formPorcentajeDed, dep.porcentajeDed, "porcentaje deduccion");
  }

  // CUIT otro deduccion (conditional on 50% porcentaje)
  if (dep.cuitOtroDed) {
    await setInput(sel.formCuitOtroDed, dep.cuitOtroDed, "CUIT otro deduccion");
  }

  // Familia a cargo (S/N select)
  await setSelect(sel.formFamiliaCargo, dep.familiaCargo ? "S" : "N", "familia a cargo");

  // Residente (S/N select)
  await setSelect(sel.formResidente, dep.residente ? "S" : "N", "residente");

  // Ingresos (S/N select)
  await setSelect(sel.formIngresos, dep.tieneIngresos ? "S" : "N", "ingresos");
  await page.waitForTimeout(300); // Wait for monto field to appear/hide

  // Monto ingresos (conditional on tieneIngresos)
  if (dep.tieneIngresos && dep.montoIngresos) {
    await setInput(sel.formMontoIngresos, dep.montoIngresos, "monto ingresos");
  }

  // Periodo
  await setSelect(sel.formMesDesde, String(dep.mesDesde), "mes desde");
  await setSelect(sel.formMesHasta, String(dep.mesHasta), "mes hasta");

  // Proximos periodos
  await setCheckbox(sel.formProximosPeriodos, dep.proximosPeriodos, "proximos periodos");

  log(`  Formulario completado para ${dep.apellido}, ${dep.nombre}`);
}
