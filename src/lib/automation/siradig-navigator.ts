import { Page } from "playwright";
import {
  getSiradigCategoryText,
  getSiradigInvoiceTypeText,
  getSiradigCategoryLinkId,
  isAlquilerCategory,
  isEducationCategory,
  isIndumentariaTrabajoCategory,
  isSchoolProvider,
} from "./deduction-mapper";
import type { ScreenshotCallback } from "./arca-navigator";

export interface InvoiceData {
  deductionCategory: string;
  providerCuit: string;
  invoiceType: string;
  invoiceNumber?: string; // "XXXXX-YYYYYYYY" (punto de venta - número)
  invoiceDate?: string; // ISO date string
  amount: string;
  fiscalMonth: number;
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
  onScreenshot?: ScreenshotCallback
): Promise<FillResult> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});

  try {
    // Step 2: Select person to represent
    log("Seleccionando persona a representar...");
    await page.waitForLoadState("networkidle");

    // The person selection page uses <input type="button" class="btn_empresa">
    // elements with the person name in the value attribute
    const personButton = page.locator("input.btn_empresa").first();
    await personButton.waitFor({ timeout: 30000 });
    await personButton.click();
    await page.waitForLoadState("networkidle");

    await capture(
      await page.screenshot({ fullPage: true }),
      "person-selected",
      "Persona seleccionada"
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
      `Periodo ${fiscalYear} seleccionado`
    );

    // Click "Continuar"
    log("Haciendo click en Continuar...");
    const continueBtn = page.getByText("Continuar").first();
    await continueBtn.click();
    await page.waitForLoadState("networkidle");

    await capture(
      await page.screenshot({ fullPage: true }),
      "after-continue",
      "Pagina principal SiRADIG"
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

    await capture(
      await page.screenshot({ fullPage: true }),
      "draft-menu",
      "Menu del borrador"
    );

    // Step 5: Click "Carga de Formulario" (#btn_carga)
    // This button uses a jQuery click handler that navigates via
    // document.location.href after a 400ms delay
    log("Accediendo a Carga de Formulario...");
    const formLoadBtn = page.locator("#btn_carga");
    await formLoadBtn.waitFor({ state: "visible", timeout: 30000 });
    await formLoadBtn.click();
    await page.waitForLoadState("networkidle");

    await capture(
      await page.screenshot({ fullPage: true }),
      "form-loaded",
      "Formulario F572 Web cargado"
    );

    // Step 6: Expand "3 - Deducciones y desgravaciones" accordion section
    log("Expandiendo seccion de Deducciones y desgravaciones...");
    const deductionsSection = page
      .getByText("Deducciones y desgravaciones")
      .first();
    await deductionsSection.waitFor({ timeout: 30000 });
    await deductionsSection.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000); // Wait for accordion animation

    await capture(
      await page.screenshot({ fullPage: true }),
      "deductions-section",
      "Seccion de deducciones expandida"
    );

    log("Navegacion a seccion de deducciones completada");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error navegando dentro de SiRADIG: ${msg}`);
    try {
      await capture(
        await page.screenshot({ fullPage: true }),
        "navigation-error",
        "Error de navegacion en SiRADIG"
      );
    } catch {
      /* screenshot may fail too */
    }
    return { success: false, error: msg };
  }
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
  onScreenshot?: ScreenshotCallback
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
      `Buscando deduccion existente para ${categoryText} / CUIT ${invoice.providerCuit} / ${monthName}...`
    );
    const categoryLower = categoryText.toLowerCase();
    const fieldsets = page.locator(
      "#div_tabla_deducciones_agrupadas fieldset.grupo_deducciones"
    );

    let foundExisting = false;
    const fieldsetCount = await fieldsets.count();
    for (let f = 0; f < fieldsetCount && !foundExisting; f++) {
      const fieldset = fieldsets.nth(f);
      const legendText =
        (await fieldset.locator("legend").textContent()) ?? "";

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
            `Deduccion existente encontrada para CUIT ${invoice.providerCuit}, periodo ${monthName}. Editando...`
          );
          const editBtn = row.locator(".act_editar");
          await editBtn.click();
          await page.waitForLoadState("networkidle");

          await capture(
            await page.screenshot({ fullPage: true }),
            "existing-entry-edit",
            "Editando deduccion existente"
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
        "Menu de tipos de deduccion abierto"
      );

      // Step 8: Select the specific deduction category by its link ID
      const linkId = getSiradigCategoryLinkId(invoice.deductionCategory);
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
        `Categoria: ${categoryText}`
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
            const el = document.getElementById(
              "razonSocial"
            ) as HTMLInputElement;
            return el && el.value.trim() !== "";
          },
          { timeout: 10000 }
        );
      } catch {
        log("No se pudo obtener la denominacion automaticamente");
      }

      await capture(
        await page.screenshot({ fullPage: true }),
        "cuit-filled",
        "CUIT ingresado y denominacion obtenida"
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
          tipoGasto === "1"
            ? "Servicios con fines educativos"
            : "Herramientas educativas";
        log(`Seleccionando tipo de gasto: ${tipoLabel}`);
        await page.selectOption("#idTipoGasto", tipoGasto);
      }

      // Step 10: Select Período (month) from #mesDesde
      const monthValue = String(invoice.fiscalMonth);
      log(
        `Seleccionando periodo: ${monthName || monthValue}`
      );
      await page.selectOption("#mesDesde", monthValue);

      // Education-specific: Select Familiar from dialog
      // Must happen AFTER period selection because #mesDesde change clears familiar
      if (isEducationCategory(invoice.deductionCategory)) {
        log("Seleccionando familiar...");
        await page.locator("#btn_seleccion_familiar").click();
        await page.waitForTimeout(1000); // Wait for dialog animation

        // Select the first family member from the "Carga de Familia" table
        const familiarRow = page
          .locator("#tabla_cargas_familia tbody tr")
          .first();
        await familiarRow.waitFor({ timeout: 5000 });
        await familiarRow.locator("td").first().click();
        await page.waitForTimeout(500);

        // Click "Aceptar" in the familiar selection dialog
        const dialogParent = page
          .locator("#dialog_seleccion_familiar")
          .locator("..");
        await dialogParent
          .locator(".ui-dialog-buttonset button")
          .first()
          .click();
        await page.waitForTimeout(500);

        await capture(
          await page.screenshot({ fullPage: true }),
          "familiar-selected",
          "Familiar seleccionado"
        );
      }
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
      "Dialogo de alta de comprobante"
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
      log(
        `Tipo "${invoiceTypeText}" no disponible, manteniendo valor por defecto`
      );
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
      "Comprobante completado"
    );

    // Step 13: Click "Agregar" button in the dialog to add the comprobante
    log("Agregando comprobante...");
    const agregarBtn = page
      .locator(".ui-dialog-buttonset")
      .getByText("Agregar");
    await agregarBtn.click();
    await page.waitForTimeout(1500); // Wait for dialog to close and table update

    // Take final screenshot showing the form with the added comprobante
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    await capture(screenshotBuffer, "form-filled", "Formulario completado");

    log(
      "Formulario completado con comprobante agregado. Esperando confirmacion."
    );
    return { success: true, screenshotBuffer };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error completando formulario: ${msg}`);
    try {
      await capture(
        await page.screenshot({ fullPage: true }),
        "form-error",
        "Error al completar formulario"
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
  onScreenshot?: ScreenshotCallback
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

    await capture(
      await page.screenshot({ fullPage: true }),
      "after-save",
      "Guardando deduccion"
    );

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
      const errorMsg =
        messages.join(" | ") || "Error de validacion desconocido";
      await capture(
        await page.screenshot({ fullPage: true }),
        "submission-error",
        "Error al guardar"
      );
      log(`Error al guardar: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    if (outcome === "success") {
      await capture(
        await page.screenshot({ fullPage: true }),
        "submission-success",
        "Deduccion guardada exitosamente"
      );
      log("Deduccion guardada exitosamente");
      return { success: true };
    }

    // Neither appeared within timeout — check for other error indicators

    // Confirmation dialog (some flows show "Aceptar" before completing)
    try {
      const confirmButton = page
        .getByText("Aceptar", { exact: true })
        .first();
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
          "Error al guardar"
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
      "Estado despues de guardar"
    );

    log("Deduccion procesada (sin confirmacion explicita)");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error guardando deduccion: ${msg}`);
    return { success: false, error: msg };
  }
}
