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
    // Navigate to deductions section
    log("Navegando a la seccion de deducciones...");
    const deductionsLink = await page.$(sel.deductionsSection);
    if (deductionsLink) {
      await deductionsLink.click();
      await page.waitForLoadState("networkidle");
    }

    await capture(
      await page.screenshot({ fullPage: true }),
      "deductions-section",
      "Seccion de deducciones"
    );

    // Click "Add deduction"
    log("Iniciando nueva deduccion...");
    const addButton = await page.$(sel.addDeductionButton);
    if (!addButton) {
      return { success: false, error: "No se encontro el boton para agregar deduccion" };
    }
    await addButton.click();
    await page.waitForLoadState("networkidle");

    // Select category
    const categoryText = getSiradigCategoryText(invoice.deductionCategory);
    log(`Seleccionando categoria: ${categoryText}`);
    await page.selectOption(sel.categoryDropdown, { label: categoryText });
    await page.waitForTimeout(1000); // Wait for dependent fields to load

    await capture(
      await page.screenshot({ fullPage: true }),
      "category-selected",
      `Categoria: ${categoryText}`
    );

    // Fill CUIT
    log(`Ingresando CUIT del proveedor: ${invoice.providerCuit}`);
    const cuitInput = await page.$(sel.cuitProviderInput);
    if (cuitInput) {
      await cuitInput.fill(invoice.providerCuit);
      await page.waitForTimeout(500);
    }

    // Select invoice type
    const invoiceTypeText = getSiradigInvoiceTypeText(invoice.invoiceType);
    log(`Seleccionando tipo de comprobante: ${invoiceTypeText}`);
    const typeSelect = await page.$(sel.invoiceTypeSelect);
    if (typeSelect) {
      await page.selectOption(sel.invoiceTypeSelect, { label: invoiceTypeText });
    }

    // Fill amount
    log(`Ingresando monto: $${invoice.amount}`);
    const amountInput = await page.$(sel.amountInput);
    if (amountInput) {
      await amountInput.fill(invoice.amount);
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
      return { success: false, error: errorText?.trim() || "Error al enviar" };
    }

    log("Deduccion procesada (sin confirmacion explicita)");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error enviando deduccion: ${msg}`);
    return { success: false, error: msg };
  }
}
