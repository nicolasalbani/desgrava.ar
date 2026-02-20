import { Page } from "playwright";
import { ARCA_SELECTORS } from "./selectors";
import { getSiradigCategoryText, getSiradigInvoiceTypeText } from "./deduction-mapper";
import type { ScreenshotCallback } from "./arca-navigator";

export interface InvoiceData {
  deductionCategory: string;
  providerCuit: string;
  invoiceType: string;
  amount: string;
  fiscalMonth: number;
}

export interface FillResult {
  success: boolean;
  error?: string;
  screenshotBuffer?: Buffer;
}

/**
 * Navigate through SiRADIG from the initial person selection page
 * all the way to the deductions section of the F572 form.
 *
 * Steps (matching the ARCA/SiRADIG UI flow):
 * 2. Select person to represent
 * 3. Select fiscal period and click "Continuar"
 * 4. Create new draft ("Crear Nuevo Borrador")
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
 * dropdown and fill in the deduction form fields.
 *
 * Steps:
 * 7. Click "Agregar Deducciones y Desgravaciones" toggle
 * 8. Select the specific category link from the expanded dropdown
 * 9. Fill form fields (CUIT, invoice type, amount, period)
 */
export async function fillDeductionForm(
  page: Page,
  invoice: InvoiceData,
  onLog?: (msg: string) => void,
  onScreenshot?: ScreenshotCallback
): Promise<FillResult> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});
  const sel = ARCA_SELECTORS.siradig;

  try {
    // Step 7: Click "Agregar Deducciones y Desgravaciones" dropdown toggle
    log("Abriendo menu de tipos de deduccion...");
    const addDeductionToggle = page
      .getByText("Agregar Deducciones y Desgravaciones")
      .first();
    await addDeductionToggle.waitFor({ timeout: 15000 });
    await addDeductionToggle.click();
    await page.waitForTimeout(1500); // Wait for dropdown/panel to expand

    await capture(
      await page.screenshot({ fullPage: true }),
      "add-deduction-menu",
      "Menu de tipos de deduccion abierto"
    );

    // Step 8: Select the specific deduction category from the expanded list
    const categoryText = getSiradigCategoryText(invoice.deductionCategory);
    log(`Seleccionando categoria: ${categoryText}`);

    // Categories appear as links in the expanded dropdown panel
    const categoryLink = page.getByText(categoryText, { exact: false }).first();
    await categoryLink.waitFor({ timeout: 10000 });
    await categoryLink.click();
    await page.waitForLoadState("networkidle");

    await capture(
      await page.screenshot({ fullPage: true }),
      "category-selected",
      `Categoria: ${categoryText}`
    );

    // Step 9: Fill the form fields for this deduction category
    // Fill CUIT
    log(`Ingresando CUIT del proveedor: ${invoice.providerCuit}`);
    const cuitInput = await page.$(sel.cuitProviderInput);
    if (cuitInput) {
      await cuitInput.fill(invoice.providerCuit);
      await page.waitForTimeout(500);
    }

    // Select invoice type (if the field exists for this category)
    const invoiceTypeText = getSiradigInvoiceTypeText(invoice.invoiceType);
    log(`Seleccionando tipo de comprobante: ${invoiceTypeText}`);
    const typeSelect = await page.$(sel.invoiceTypeSelect);
    if (typeSelect) {
      await page.selectOption(sel.invoiceTypeSelect, {
        label: invoiceTypeText,
      });
    }

    // Fill amount
    log(`Ingresando monto: $${invoice.amount}`);
    const amountInput = await page.$(sel.amountInput);
    if (amountInput) {
      await amountInput.fill(invoice.amount);
    }

    // Select month/period (if the field exists for this category)
    const monthSelect = await page.$(sel.periodFromSelect);
    if (monthSelect) {
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
      if (monthName) {
        log(`Seleccionando periodo: ${monthName}`);
        try {
          await page.selectOption(sel.periodFromSelect, { label: monthName });
        } catch {
          // Fallback: try by value (month number)
          try {
            await page.selectOption(
              sel.periodFromSelect,
              String(invoice.fiscalMonth)
            );
          } catch {
            log("No se pudo seleccionar el periodo automaticamente");
          }
        }
      }
    }

    // Take screenshot for preview
    log("Capturando screenshot de preview...");
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    await capture(screenshotBuffer, "form-filled", "Formulario completado");

    log("Formulario completado. Esperando confirmacion del usuario.");
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

export async function submitDeduction(
  page: Page,
  onLog?: (msg: string) => void,
  onScreenshot?: ScreenshotCallback
): Promise<FillResult> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});
  const sel = ARCA_SELECTORS.siradig;

  try {
    log("Enviando deduccion...");
    const saveButton = await page.$(sel.saveButton);
    if (!saveButton) {
      return { success: false, error: "No se encontro el boton Guardar" };
    }
    await saveButton.click();
    await page.waitForLoadState("networkidle");

    await capture(
      await page.screenshot({ fullPage: true }),
      "after-save",
      "Guardando deduccion"
    );

    // Check for confirmation dialog
    const confirmButton = await page.$(sel.confirmButton);
    if (confirmButton) {
      log("Confirmando envio...");
      await confirmButton.click();
      await page.waitForLoadState("networkidle");
    }

    // Check for success
    const success = await page.$(sel.successMessage);
    if (success) {
      await capture(
        await page.screenshot({ fullPage: true }),
        "submission-success",
        "Deduccion enviada exitosamente"
      );
      log("Deduccion enviada exitosamente");
      return { success: true };
    }

    // Check for errors
    const errorEl = await page.$(sel.errorContainer);
    if (errorEl) {
      const errorText = await errorEl.textContent();
      await capture(
        await page.screenshot({ fullPage: true }),
        "submission-error",
        "Error al enviar"
      );
      log(`Error al enviar: ${errorText}`);
      return {
        success: false,
        error: errorText?.trim() || "Error al enviar",
      };
    }

    log("Deduccion procesada (sin confirmacion explicita)");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error enviando deduccion: ${msg}`);
    return { success: false, error: msg };
  }
}
