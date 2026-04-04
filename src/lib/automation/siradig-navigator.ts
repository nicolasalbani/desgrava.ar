import { Page } from "playwright";
import {
  getSiradigCategoryText,
  getSiradigInvoiceTypeText,
  getSiradigCategoryLinkId,
  getAlquilerLinkId,
  isAlquilerCategory,
  isDetalleMensualCategory,
  isEducationCategory,
  isIndumentariaTrabajoCategory,
  isSchoolProvider,
  reverseLookupCategory,
  reverseLookupInvoiceType,
} from "./deduction-mapper";
import { ARCA_SELECTORS } from "./selectors";
import type { ScreenshotCallback } from "./arca-navigator";

/**
 * First-time SiRADIG users must confirm their personal data before
 * "Empleadores" and "Carga de Formulario" buttons become enabled.
 * This detects the disabled state and confirms the data automatically.
 */
async function confirmDatosPersonalesIfNeeded(
  page: Page,
  onLog?: (msg: string) => void,
  onScreenshot?: ScreenshotCallback,
): Promise<void> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});
  const sel = ARCA_SELECTORS.siradig;

  const cargaBtn = page.locator(ARCA_SELECTORS.siradigPresentaciones.cargaFormularioBtn);
  const isDisabled = await cargaBtn.evaluate(
    (el) =>
      el.classList.contains("ui-state-disabled") || el.getAttribute("aria-disabled") === "true",
  );

  if (!isDisabled) return;

  log("Botones deshabilitados — confirmando Datos Personales (usuario nuevo en SiRADIG)...");

  // Navigate to Datos Personales
  const datosBtn = page.locator(sel.datosPersonales.menuButton);
  await datosBtn.click();
  await page.waitForLoadState("networkidle");

  await capture(
    await page.screenshot({ fullPage: true }),
    "datos-personales",
    "Datos Personales (confirmacion)",
  );

  // Click Guardar to confirm personal data
  log("Guardando Datos Personales...");
  const guardarBtn = page.locator(sel.datosPersonales.guardarBtn);
  await guardarBtn.waitFor({ state: "visible", timeout: 10_000 });
  await guardarBtn.click();
  await page.waitForLoadState("networkidle");

  await capture(
    await page.screenshot({ fullPage: true }),
    "datos-personales-saved",
    "Datos Personales guardados",
  );

  // Return to main menu
  log("Volviendo al menu principal...");
  const volverBtn = page.locator(sel.datosPersonales.volverBtn);
  await volverBtn.waitFor({ state: "visible", timeout: 10_000 });
  await volverBtn.click();
  await page.waitForLoadState("networkidle");

  log("Datos Personales confirmados, botones habilitados");
}

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
  /** True when the error indicates the comprobante already exists in SiRADIG */
  isDuplicate?: boolean;
  /** True when the comprobante was already in SiRADIG — no save needed */
  alreadyExists?: boolean;
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
 * Navigate through SiRADIG from the person selection page to the main menu.
 * This performs: select person → select period → Continuar → dismiss modal → create/reuse draft.
 * After this, the page shows the SiRADIG main menu with buttons like
 * "Carga de Formulario", "Consulta de Formularios Enviados", etc.
 */
export async function navigateToSiradigMainMenu(
  page: Page,
  fiscalYear: number,
  onLog?: (msg: string) => void,
  onScreenshot?: ScreenshotCallback,
): Promise<FillResult> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});

  try {
    log(`Seleccionando persona a representar... (URL: ${page.url()})`);
    await page.waitForLoadState("networkidle");

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

    log(`Seleccionando periodo fiscal ${fiscalYear}...`);

    // After March 31st, the previous fiscal year is no longer accessible in SiRADIG,
    // so only the current year remains. When there's a single fiscal year available,
    // SiRADIG auto-selects it and skips the period selection page entirely
    // (URL already contains ?codigo=YYYY). Only select if the <select> appears.
    const periodSelect = page.locator("select").first();
    const hasPeriodSelect = await periodSelect
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (hasPeriodSelect) {
      await periodSelect.selectOption(String(fiscalYear));

      log("Haciendo click en Continuar...");
      const continueBtn = page.getByText("Continuar").first();
      await continueBtn.click();
      await page.waitForLoadState("networkidle");
      log(`Despues de Continuar. URL: ${page.url()}`);
    } else {
      log(
        "Periodo fiscal ya seleccionado automaticamente (unico periodo disponible), continuando...",
      );
    }

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
      // Modal didn't appear
    }

    // Create new draft if needed
    const createDraftBtn = page.locator("#btn_nuevo_borrador");
    if (await createDraftBtn.isVisible()) {
      log("Creando nuevo borrador...");
      await createDraftBtn.click();
      await page.waitForTimeout(2000);
    } else {
      log("Borrador existente detectado, continuando...");
    }

    await capture(await page.screenshot({ fullPage: true }), "draft-menu", "Menu del borrador");

    // First-time users must confirm Datos Personales before other buttons enable
    await confirmDatosPersonalesIfNeeded(page, onLog, onScreenshot);

    log("Navegacion al menu principal de SiRADIG completada");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error navegando dentro de SiRADIG: ${msg} | URL: ${page.url()}`);
    return { success: false, error: msg };
  }
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

    // After March 31st, the previous fiscal year is no longer accessible in SiRADIG,
    // so only the current year remains. When there's a single fiscal year available,
    // SiRADIG auto-selects it and skips the period selection page entirely
    // (URL already contains ?codigo=YYYY). Only select if the <select> appears.
    const periodSelect = page.locator("select").first();
    const hasPeriodSelect = await periodSelect
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (hasPeriodSelect) {
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
    } else {
      log(
        "Periodo fiscal ya seleccionado automaticamente (unico periodo disponible), continuando...",
      );
    }

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

    // First-time users must confirm Datos Personales before other buttons enable
    await confirmDatosPersonalesIfNeeded(page, onLog, onScreenshot);

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
    await dismissDialogOverlay(page);
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
 * 10. Select Período (month) — via #mesDesde select for standard categories,
 *     or via "Agregar Mes Individual" (#btn_alta_mes) dialog for Detalle Mensual categories
 * 11. Click comprobante button (or "Agregar Comprobante" link) to open dialog
 * 12. Fill comprobante fields (fecha, tipo, número, monto, monto reintegrado if present)
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

      // Step 10: Select Período (month)
      // - ALQUILER_VIVIENDA: handled separately via fillAlquilerLocatarioForm
      // - Detalle Mensual categories (CUOTAS_MEDICO, PRIMAS, APORTES): use #btn_alta_mes dialog
      // - All other categories: use #mesDesde select dropdown
      const monthValue = String(invoice.fiscalMonth);
      if (isDetalleMensualCategory(invoice.deductionCategory)) {
        log(`Agregando detalle mensual: ${monthName || monthValue}`);
        const altaMesBtn = page.locator("#btn_alta_mes");
        await altaMesBtn.waitFor({ state: "visible", timeout: 15000 });
        await altaMesBtn.click();
        await page.waitForTimeout(1000);

        await page.selectOption("#detalleIndividualMes", monthValue);
        await page.fill("#detalleIndividualMontoMensual", invoice.amount);

        // Scope to the visible dialog containing #detalleIndividualMes to avoid
        // strict mode violations (multiple dialogs have "Agregar" buttons)
        const mesDialog = page.locator(".ui-dialog:visible:has(#detalleIndividualMes)");
        await mesDialog.locator(".ui-dialog-buttonset").getByText("Agregar").click();
        await page.waitForTimeout(1500);
        await dismissDialogOverlay(page);

        await capture(
          await page.screenshot({ fullPage: true }),
          "month-detail-added",
          `Detalle mensual agregado: ${monthName}`,
        );
      } else if (invoice.deductionCategory !== "ALQUILER_VIVIENDA") {
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
              "Factura educativa sin familiar vinculado. Vincula un familiar en desgrava.ar antes de desgravar.",
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

    // Step 11: Click comprobante button to open the dialog
    // Detalle Mensual categories use "Agregar Comprobante" link (#btn_alta_comprobante_detalle or text)
    // Other categories use #btn_alta_comprobante button
    log("Abriendo formulario de alta de comprobante...");
    const altaBtn = isDetalleMensualCategory(invoice.deductionCategory)
      ? page.getByText("Agregar Comprobante", { exact: false }).first()
      : page.locator("#btn_alta_comprobante");
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
      // Dismiss jQuery UI datepicker that opens on focus/fill — it overlays the dialog
      // and intercepts pointer events on the "Agregar" button
      await page.evaluate(() => {
        const dp = document.getElementById("ui-datepicker-div");
        if (dp) dp.style.display = "none";
      });
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

    // Step 13: Click "Agregar" button in the comprobante dialog
    // Scope to the dialog containing #cmpMontoFacturado to avoid strict mode violations
    log("Agregando comprobante...");
    const comprobanteDialog = page.locator(".ui-dialog:visible:has(#cmpMontoFacturado)");
    const agregarBtn = comprobanteDialog.locator(".ui-dialog-buttonset").getByText("Agregar");
    await agregarBtn.click();
    await page.waitForTimeout(1500); // Wait for dialog to close and table update
    await dismissDialogOverlay(page);

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

    // Dismiss any lingering dialog overlay before clicking Guardar
    await dismissDialogOverlay(page);

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
      const isDuplicate = isDuplicateError(errorMsg);
      await capture(
        await page.screenshot({ fullPage: true }),
        isDuplicate ? "duplicate-detected" : "submission-error",
        isDuplicate ? "Comprobante duplicado detectado" : "Error al guardar",
      );
      log(
        isDuplicate
          ? `Comprobante ya existe en SiRADIG: ${errorMsg}`
          : `Error al guardar: ${errorMsg}`,
      );
      return { success: false, error: errorMsg, isDuplicate };
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

      // Read all form fields using Playwright locators to avoid esbuild __name injection
      // that breaks page.evaluate in production (Next.js server-side bundling).
      const getValue = async (selector: string) => {
        const el = page.locator(selector);
        return (await el.isVisible().catch(() => false))
          ? await el.inputValue().catch(() => "")
          : "";
      };
      const isChecked = async (selector: string) => {
        const el = page.locator(selector);
        return (await el.isVisible().catch(() => false))
          ? await el.isChecked().catch(() => false)
          : false;
      };

      const data = {
        tipoDoc: await getValue(sel.formTipoDoc),
        numeroDoc: await getValue(sel.formNumeroDoc),
        apellido: await getValue(sel.formApellido),
        nombre: await getValue(sel.formNombre),
        fechaNacimiento: await getValue(sel.formFechaNacimiento),
        parentesco: await getValue(sel.formParentesco),
        fechaCasamiento: await getValue(sel.formFechaCasamiento),
        porcentajeDed: await getValue(sel.formPorcentajeDed),
        cuitOtroDed: await getValue(sel.formCuitOtroDed),
        familiaCargo: await getValue(sel.formFamiliaCargo),
        residente: await getValue(sel.formResidente),
        ingresos: await getValue(sel.formIngresos),
        montoIngresos: await getValue(sel.formMontoIngresos),
        mesDesde: await getValue(sel.formMesDesde),
        mesHasta: await getValue(sel.formMesHasta),
        proximosPeriodos: await isChecked(sel.formProximosPeriodos),
      };

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

// ── Duplicate detection & edit flow ─────────────────────────

/**
 * Patterns in SiRADIG error messages that indicate a duplicate comprobante.
 * These are matched case-insensitively against the concatenated error text.
 */
const DUPLICATE_PATTERNS = [
  "ya fue informado",
  "ya fue cargado",
  "ya existe",
  "comprobante existente",
  "datos duplicados",
  "comprobante ya",
  "duplicado",
];

/**
 * Check if a SiRADIG error message indicates a duplicate comprobante.
 */
export function isDuplicateError(errorMsg: string): boolean {
  const lower = errorMsg.toLowerCase();
  return DUPLICATE_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Attempt to find and edit an existing deduction entry in SiRADIG
 * after a duplicate was detected during submission.
 *
 * Dispatches to per-category edit handlers. Categories without a specific
 * handler return a descriptive error asking the user to edit manually.
 *
 * Flow:
 *  1. Navigate back to the deduction list (#div_listado)
 *  2. Find the matching row in the category's deduction table
 *  3. Click edit → fill updated values → save
 */
export async function findAndEditExisting(
  page: Page,
  invoice: InvoiceData,
  onLog?: (msg: string) => void,
  onScreenshot?: ScreenshotCallback,
): Promise<FillResult> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});

  try {
    log("Comprobante ya existe en SiRADIG — intentando actualizar...");

    // Step 1: Go back to the deduction list view
    const volverBtn = page.locator(ARCA_SELECTORS.siradigEdit.editVolverBtn);
    await volverBtn.click().catch(() => {
      // Volver might not exist if we're already on the list view
    });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1000);

    // Re-expand the "Deducciones y desgravaciones" accordion — it may collapse after Volver
    try {
      const deductionsHeader = page.getByText("Deducciones y desgravaciones").first();
      const isExpanded = await page
        .locator("#div_tabla_deducciones_agrupadas")
        .isVisible()
        .catch(() => false);
      if (!isExpanded) {
        log("Re-expandiendo seccion de deducciones...");
        await deductionsHeader.click();
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(1000);
      }
    } catch {
      // Section might already be expanded
    }

    await capture(
      await page.screenshot({ fullPage: true }),
      "edit-list-view",
      "Lista de deducciones existentes",
    );

    // Step 2: Dispatch to per-category edit handler
    switch (invoice.deductionCategory) {
      case "GASTOS_MEDICOS":
        return await editStandardDeductionEntry(
          page,
          invoice,
          ARCA_SELECTORS.siradigEdit.gastosMedicosTable as string,
          "Gastos Medicos",
          log,
          capture,
        );

      case "GASTOS_INDUMENTARIA_TRABAJO":
        return await editStandardDeductionEntry(
          page,
          invoice,
          ARCA_SELECTORS.siradigEdit.gastosIndumentariaTable as string,
          "Gastos de Indumentaria",
          log,
          capture,
        );

      case "GASTOS_EDUCATIVOS":
        return await editStandardDeductionEntry(
          page,
          invoice,
          ARCA_SELECTORS.siradigEdit.gastosEducativosTable as string,
          "Gastos de Educacion",
          log,
          capture,
        );

      case "ALQUILER_VIVIENDA":
        return await editAlquilerEntry(page, invoice, log, capture);

      default:
        log(
          `Flujo de actualización aun no implementado para categoria: ${invoice.deductionCategory}. ` +
            `Editar manualmente en SiRADIG.`,
        );
        return {
          success: false,
          error:
            `Comprobante duplicado — actualización automatica no disponible para ${invoice.deductionCategory}. ` +
            `Editar manualmente en SiRADIG.`,
        };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error al intentar editar comprobante existente: ${msg}`);
    try {
      await capture(
        await page.screenshot({ fullPage: true }),
        "edit-error",
        "Error editando comprobante existente",
      );
    } catch {
      /* screenshot may fail too */
    }
    return { success: false, error: `Error al editar existente: ${msg}` };
  }
}

const MONTH_NAMES = [
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

/**
 * Edit an existing ALQUILER_VIVIENDA entry in SiRADIG.
 *
 * The alquiler edit form differs from standard deductions:
 *   - It has a monthly detail table (#tabla_meses) with per-month amounts
 *   - Each month row has its own comprobante sub-table
 *   - Contract dates and locador fields are at the top
 *
 * Strategy:
 *   1. Find the existing entry by fieldset legend ("alquiler") + CUIT
 *   2. Click edit to open the edit form
 *   3. Check if the target month already exists in #tabla_meses
 *      - If yes: delete that month row, then re-add with updated values
 *      - If no: add the month as a new row
 *   4. Return success so the caller can call submitDeduction()
 */
async function editAlquilerEntry(
  page: Page,
  invoice: InvoiceData,
  log: (msg: string) => void,
  capture: (buffer: Buffer, slug: string, label: string) => Promise<void>,
): Promise<FillResult> {
  const cuitDigits = invoice.providerCuit.replace(/-/g, "");
  const monthName = MONTH_NAMES[invoice.fiscalMonth] || "";

  log(`Buscando entrada de alquiler existente: CUIT ${cuitDigits}, periodo ${monthName}...`);

  // Find the alquiler entry by searching all fieldsets in the deducciones container.
  // Search broadly: first in #div_tabla_deducciones_agrupadas, then across all fieldsets on page.
  // Alquiler fieldsets may or may not have .grupo_deducciones class.
  // Each row represents a contract — match by CUIT first, then prefer rows whose
  // period text contains the target month name (e.g. "Julio").
  const match = await page.evaluate(
    ({ cuit, month }: { cuit: string; month: string }) => {
      const containers = [
        "#div_tabla_deducciones_agrupadas fieldset",
        "#content fieldset",
        "fieldset",
      ];
      let bestMatch: {
        selector: string;
        fieldsetIdx: number;
        rowIdx: number;
      } | null = null;

      for (const selector of containers) {
        const fieldsets = document.querySelectorAll(selector);
        for (let f = 0; f < fieldsets.length; f++) {
          const legend = fieldsets[f].querySelector("legend");
          const legendText = legend?.textContent?.toLowerCase() ?? "";
          if (
            !legendText.includes("alquiler") &&
            !legendText.includes("locatario") &&
            !legendText.includes("inquilino")
          )
            continue;
          const rows = fieldsets[f].querySelectorAll("table tbody tr");
          for (let r = 0; r < rows.length; r++) {
            const text = (rows[r].textContent || "").replace(/-/g, "");
            if (!text.includes(cuit)) continue;
            // Exact period match — best result
            if (month && rows[r].textContent?.includes(month)) {
              return { selector, fieldsetIdx: f, rowIdx: r };
            }
            // CUIT-only match — keep as fallback
            if (!bestMatch) {
              bestMatch = { selector, fieldsetIdx: f, rowIdx: r };
            }
          }
        }
        // If we found any match in this scope, use it (don't broaden further)
        if (bestMatch) return bestMatch;
      }
      return bestMatch;
    },
    { cuit: cuitDigits, month: monthName },
  );

  if (!match) {
    // Log available fieldsets for debugging
    const debugInfo = await page.evaluate(() => {
      const fieldsets = document.querySelectorAll("fieldset");
      return Array.from(fieldsets).map((f) => ({
        legend: f.querySelector("legend")?.textContent?.trim().substring(0, 80) ?? "(no legend)",
        classes: f.className,
        rowCount: f.querySelectorAll("table tbody tr").length,
      }));
    });
    log(
      `No se encontro entrada de alquiler para CUIT ${cuitDigits}. Fieldsets visibles: ${JSON.stringify(debugInfo)}`,
    );
    return {
      success: false,
      error: `No se encontro la entrada de alquiler existente para CUIT ${cuitDigits}`,
    };
  }

  log(
    `Entrada de alquiler encontrada (${match.selector}, fieldset ${match.fieldsetIdx}). Abriendo formulario de edicion...`,
  );

  // Click the edit button on the matching row
  await page.evaluate(
    ({ selector, fIdx, rIdx }: { selector: string; fIdx: number; rIdx: number }) => {
      const fieldsets = document.querySelectorAll(selector);
      const rows = fieldsets[fIdx].querySelectorAll("table tbody tr");
      const editBtn = rows[rIdx].querySelector("div.act_editar");
      if (editBtn) (editBtn as HTMLElement).click();
    },
    { selector: match.selector, fIdx: match.fieldsetIdx, rIdx: match.rowIdx },
  );

  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);

  await capture(
    await page.screenshot({ fullPage: true }),
    "alquiler-edit-form",
    "Formulario de edicion de alquiler abierto",
  );

  // Verify we're in the edit form by checking for the monthly detail table
  const hasMesTable = await page
    .locator("#tabla_meses")
    .isVisible()
    .catch(() => false);

  if (!hasMesTable) {
    log("No se detecto el formulario de edicion (tabla de meses no visible)");
    return {
      success: false,
      error: "No se pudo abrir el formulario de edicion de alquiler",
    };
  }

  // Check if the target month already exists in the monthly detail table.
  // The table ID is #tabla_meses; cell format is "07 - Julio".
  // Match by month name (case-insensitive, includes) or numeric prefix (e.g. "07").
  const monthValue = String(invoice.fiscalMonth);
  const paddedMonth = monthValue.padStart(2, "0"); // "7" → "07"
  const monthSearch = await page.evaluate(
    ({
      monthName,
      monthNum,
      paddedMonth,
    }: {
      monthName: string;
      monthNum: string;
      paddedMonth: string;
    }) => {
      // Try #tabla_meses first, then any table in the page that has "Mes" header
      const table =
        document.querySelector("#tabla_meses") ??
        document.querySelector("table:has(th:first-child)");
      if (!table) return { idx: -1, rowTexts: ["(tabla no encontrada)"], tableId: "none" };

      const rows = table.querySelectorAll("tbody tr");
      const rowTexts: string[] = [];
      for (let i = 0; i < rows.length; i++) {
        const rowText = rows[i].textContent?.trim() ?? "";
        rowTexts.push(rowText);
        const lower = rowText.toLowerCase();
        // Match "07 - Julio", "Julio", "7", "07"
        if (
          lower.includes(monthName.toLowerCase()) ||
          Array.from(rows[i].querySelectorAll("td")).some((td) => {
            const cellText = td.textContent?.trim() ?? "";
            return (
              cellText === monthNum ||
              cellText === paddedMonth ||
              cellText.startsWith(paddedMonth + " ")
            );
          })
        ) {
          return { idx: i, rowTexts, tableId: table.id || "(no id)" };
        }
      }
      return { idx: -1, rowTexts, tableId: table.id || "(no id)" };
    },
    { monthName, monthNum: monthValue, paddedMonth },
  );

  const existingMonthIdx = monthSearch.idx;
  if (existingMonthIdx === -1) {
    log(
      `Mes ${monthName} no encontrado en tabla ${monthSearch.tableId}. Filas: ${JSON.stringify(monthSearch.rowTexts.map((t) => t.substring(0, 80)))}`,
    );
  }

  if (existingMonthIdx >= 0) {
    // Month already exists — delete it so we can re-add with updated values
    log(
      `Mes ${monthName} ya existe en la entrada (fila ${existingMonthIdx + 1}). Eliminando para actualizar...`,
    );

    // The delete handler is bound via jQuery .live() on "#tabla_meses div span"
    // and uses window.confirm() — a native browser dialog. We must:
    // 1. Override window.confirm to auto-accept
    // 2. Trigger the click on the <span> inside div.eliminar via jQuery
    const deleteSelector =
      monthSearch.tableId !== "none" ? `#${monthSearch.tableId}` : "#tabla_meses";
    await page.evaluate(
      ({ tableSelector, idx }: { tableSelector: string; idx: number }) => {
        // Override confirm to auto-accept the "¿Está seguro?" dialog
        const origConfirm = window.confirm;
        window.confirm = () => true;
        try {
          const table = document.querySelector(tableSelector);
          if (!table) return;
          const rows = table.querySelectorAll("tbody tr");
          // Click the <span> inside div.eliminar — jQuery .live() listens on
          // "#tabla_meses div span", not on the div itself
          const span = rows[idx].querySelector("div.eliminar span");
          if (span) {
            (window as any).$(span).trigger("click");
          }
        } finally {
          window.confirm = origConfirm;
        }
      },
      { tableSelector: deleteSelector, idx: existingMonthIdx },
    );
    await page.waitForTimeout(1000);

    log("Mes eliminado. Agregando con valores actualizados...");
  } else {
    log(`Mes ${monthName} no existe en la entrada. Agregando nuevo mes...`);
  }

  // Add the month with updated values
  log("Abriendo dialogo de agregar mes...");
  await page.evaluate(() => {
    (window as any).$("#btn_alta_mes").trigger("click");
  });
  await page.waitForTimeout(1000);

  // Select month
  log(`Seleccionando mes: ${monthValue}`);
  await page.evaluate((v: string) => {
    (window as any).$("#detalleIndividualMes").val(v).trigger("change");
  }, monthValue);
  await page.waitForTimeout(300);

  // Type amount
  log(`Ingresando monto de alquiler: $${invoice.amount}`);
  const montoField = page.locator("#detalleIndividualMontoRealMensual");
  await montoField.click();
  await montoField.fill("");
  await montoField.pressSequentially(invoice.amount, { delay: 30 });
  await montoField.press("Tab");
  await page.waitForTimeout(800);

  // Click "Agregar" in the mes dialog
  log("Confirmando mes individual...");
  const mesDialog = page.locator(".ui-dialog").filter({ has: page.locator("#dialog_alta_mes") });
  const mesAgregarBtn = mesDialog.locator(".ui-dialog-buttonset button").first();
  await mesAgregarBtn.waitFor({ state: "visible", timeout: 5000 });
  await mesAgregarBtn.click();
  await page.waitForTimeout(1500);

  // Add comprobante — non-fatal
  try {
    // First, delete any existing comprobante with the same invoice number
    // to avoid "comprobante duplicado" errors. The delete handler uses
    // window.confirm() via jQuery .live() on "#tabla_comprobantes div span".
    if (invoice.invoiceNumber) {
      const deletedCmp = await page.evaluate(
        ({ invoiceNum }: { invoiceNum: string }) => {
          const table = document.querySelector("#tabla_comprobantes");
          if (!table) return false;
          const rows = table.querySelectorAll("tbody tr");
          for (let i = 0; i < rows.length; i++) {
            const text = rows[i].textContent || "";
            // Match by invoice number (e.g. "00002 - 00000078" or "00002-00000078")
            const normalizedNum = invoiceNum.replace("-", " - ");
            if (text.includes(invoiceNum) || text.includes(normalizedNum)) {
              const origConfirm = window.confirm;
              window.confirm = () => true;
              try {
                const span = rows[i].querySelector("div.eliminar span");
                if (span) {
                  (window as any).$(span).trigger("click");
                  return true;
                }
              } finally {
                window.confirm = origConfirm;
              }
            }
          }
          return false;
        },
        { invoiceNum: invoice.invoiceNumber },
      );
      if (deletedCmp) {
        log("Comprobante existente eliminado para reemplazar.");
        await page.waitForTimeout(1000);
      }
    }

    log("Agregando comprobante actualizado...");
    const lastMesRow = page.locator("#tabla_meses tbody tr").last();
    const cmpCellLink = lastMesRow.locator("td").nth(3).locator("a, button").first();

    const cmpOpened = await cmpCellLink.isVisible().catch(() => false);
    if (cmpOpened) {
      await cmpCellLink.click();
    } else {
      await page.locator("#btn_alta_comprobante").click();
    }
    await page.waitForTimeout(1000);

    // Fill comprobante fields
    if (invoice.invoiceDate) {
      const dateStr = formatDateDDMMYYYY(invoice.invoiceDate);
      await page.evaluate((d: string) => {
        (window as any).$("#cmpFechaEmision").val(d).trigger("change");
      }, dateStr);
      await page.waitForTimeout(300);
    }

    const invoiceTypeText = getSiradigInvoiceTypeText(invoice.invoiceType);
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

    await page.evaluate((v: string) => {
      (window as any).$("#cmpMontoFacturado").val(v).trigger("change");
    }, invoice.amount);

    // Click "Agregar" in comprobante dialog
    const cmpDialog = page
      .locator(".ui-dialog")
      .filter({ has: page.locator("#dialog_alta_comprobante") });
    const cmpAgregarBtn = cmpDialog.locator(".ui-dialog-buttonset button").first();
    await cmpAgregarBtn.waitFor({ state: "visible", timeout: 5000 });
    await cmpAgregarBtn.click();
    await page.waitForTimeout(1500);
    await dismissDialogOverlay(page);
  } catch (err) {
    log(
      `Advertencia: no se pudo agregar el comprobante (${err instanceof Error ? err.message : err}). Continuando con Guardar...`,
    );
  }

  await capture(
    await page.screenshot({ fullPage: true }),
    "alquiler-edit-ready",
    "Formulario de edicion de alquiler listo para guardar",
  );

  log("Formulario de edicion de alquiler listo para guardar");
  return { success: true };
}

/**
 * Edit an existing standard deduction entry in SiRADIG.
 * Works for categories whose edit form follows the common pattern:
 *   - CUIT + monto are read-only
 *   - Comprobantes sub-table with add/delete
 *   - Matching by CUIT + Periodo (month name) in the list table
 *
 * Verified for: Gastos Médicos (#nueva_tabla_deducciones7),
 *               Gastos de Educación (#nueva_tabla_deducciones32)
 * Recorded via /arca-assisted-navigation on 2026-03-15.
 */
async function editStandardDeductionEntry(
  page: Page,
  invoice: InvoiceData,
  tableSelector: string,
  categoryLabel: string,
  log: (msg: string) => void,
  capture: (buffer: Buffer, slug: string, label: string) => Promise<void>,
): Promise<FillResult> {
  const sel = ARCA_SELECTORS.siradigEdit;
  const monthName = MONTH_NAMES[invoice.fiscalMonth] || "";
  const cuitDigits = invoice.providerCuit.replace(/[-\s]/g, "");

  log(`Buscando entrada existente: CUIT ${cuitDigits} / ${monthName} en ${categoryLabel}...`);

  // Find the matching row in the deduction list table
  const rowIndex = await page.evaluate(
    ({ tableSelector, listRowSelector, cuit, month }) => {
      const table = document.querySelector(tableSelector);
      if (!table) return -1;
      const rows = table.querySelectorAll(listRowSelector);
      for (let i = 0; i < rows.length; i++) {
        const text = rows[i].textContent || "";
        if (text.includes(cuit) && text.includes(month)) return i;
      }
      return -1;
    },
    {
      tableSelector,
      listRowSelector: sel.listRow as string,
      cuit: cuitDigits,
      month: monthName,
    },
  );

  if (rowIndex === -1) {
    log(
      `No se encontro entrada para CUIT ${cuitDigits} / ${monthName} en la tabla de ${categoryLabel}`,
    );
    return {
      success: false,
      error: `No se encontro la entrada existente para CUIT ${cuitDigits} / ${monthName}`,
    };
  }

  log(`Entrada encontrada en fila ${rowIndex + 1}. Abriendo formulario de edicion...`);

  // Click the edit button on the matching row
  await page.evaluate(
    ({ tableSelector, listRowSelector, editBtnSelector, idx }) => {
      const table = document.querySelector(tableSelector);
      const rows = table!.querySelectorAll(listRowSelector);
      const editBtn = rows[idx].querySelector(editBtnSelector);
      if (editBtn) (editBtn as HTMLElement).click();
    },
    {
      tableSelector,
      listRowSelector: sel.listRow as string,
      editBtnSelector: sel.editButton as string,
      idx: rowIndex,
    },
  );

  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);

  await capture(
    await page.screenshot({ fullPage: true }),
    "edit-form-open",
    "Formulario de edicion abierto",
  );

  // Verify we're in the edit form by checking for the comprobantes table
  const hasCompTable = await page
    .locator(sel.comprobantesTable)
    .isVisible()
    .catch(() => false);

  if (!hasCompTable) {
    log("No se detecto el formulario de edicion (tabla de comprobantes no visible)");
    return {
      success: false,
      error: `No se pudo abrir el formulario de edicion de ${categoryLabel}`,
    };
  }

  // Check if the invoice's comprobante already exists in the edit form's table.
  // SiRADIG rejects re-adding a comprobante with the same number (server-side dedup),
  // so we only delete+re-add if the number differs. If it matches, just save as-is.
  const invoiceNumber = invoice.invoiceNumber ?? "";
  const existingComprobantes = await page.evaluate((tableSelector) => {
    const table = document.querySelector(tableSelector);
    if (!table) return [];
    return Array.from(table.querySelectorAll("tbody tr")).map((tr) => {
      const cells = Array.from(tr.querySelectorAll("td"));
      return cells.map((td) => td.textContent?.trim() ?? "");
    });
  }, sel.comprobantesTable as string);

  // Check if any existing comprobante matches the invoice number
  const normalizedInvoiceNum = invoiceNumber.replace(/\s/g, "");
  const alreadyHasComprobante = existingComprobantes.some((cells) =>
    cells.some((cell) => cell.replace(/\s/g, "") === normalizedInvoiceNum),
  );

  if (alreadyHasComprobante) {
    // Comprobante already exists — nothing to change, skip save entirely.
    log(`Comprobante ${invoiceNumber} ya existe en la entrada — ya está deducido en SiRADIG`);
    // Click "Volver" to exit the edit form without saving
    const volverBtn = page.getByText("Volver", { exact: true }).first();
    await volverBtn.click().catch(() => {});
    await page.waitForLoadState("networkidle").catch(() => {});
    return { success: true, alreadyExists: true };
  } else {
    // Different comprobante — delete existing ones and add the new one
    log("Eliminando comprobantes existentes...");
    const deleteCount = await page
      .locator(`${sel.comprobantesTable} ${sel.deleteComprobanteBtn}`)
      .count();

    for (let i = 0; i < deleteCount; i++) {
      await page.locator(`${sel.comprobantesTable} ${sel.deleteComprobanteBtn}`).first().click();
      await page.waitForTimeout(500);
    }

    log("Agregando comprobante actualizado...");
    await page.locator(sel.altaComprobanteBtn).click();
    await page.waitForTimeout(1000);
    await fillComprobanteDialog(page, invoice, log);
  }

  await capture(
    await page.screenshot({ fullPage: true }),
    "edit-ready-to-save",
    "Formulario de edicion listo para guardar",
  );

  // The form is now ready — submitDeduction (called by the job processor) will click Guardar
  log("Formulario de edicion listo para guardar");
  return { success: true };
}

/**
 * Fill the "Alta de Comprobante" dialog fields and click Agregar.
 *
 * Verified selectors via /arca-assisted-navigation on 2026-03-15:
 *   #cmpFechaEmision, #cmpTipo, #cmpPuntoVenta, #cmpNumero,
 *   #cmpMontoFacturado, #cmpMontoReintegrado, button "Agregar"
 */
async function fillComprobanteDialog(
  page: Page,
  invoice: InvoiceData,
  log: (msg: string) => void,
): Promise<void> {
  const sel = ARCA_SELECTORS.siradigEdit;

  // Wait for the dialog to open
  await page.locator(sel.cmpTipo).waitFor({ state: "visible", timeout: 10000 });

  // Invoice date
  if (invoice.invoiceDate) {
    const dateStr = formatDateDDMMYYYY(invoice.invoiceDate);
    log(`Ingresando fecha: ${dateStr}`);
    await page.evaluate((d: string) => {
      (window as any).$("#cmpFechaEmision").val(d).trigger("change");
    }, dateStr);
    await page.waitForTimeout(300);
  }

  // Invoice type select
  if (invoice.invoiceType) {
    const typeValue = mapInvoiceTypeToSiradigValue(invoice.invoiceType);
    if (typeValue) {
      log(`Seleccionando tipo de comprobante: ${invoice.invoiceType}`);
      await page.evaluate((val: string) => {
        (window as any).$("#cmpTipo").val(val).trigger("change");
      }, typeValue);
      await page.waitForTimeout(500);
    }
  }

  // Invoice number: split "XXXXX-YYYYYYYY" into punto de venta + numero
  if (invoice.invoiceNumber) {
    const parts = invoice.invoiceNumber.split("-");
    if (parts.length === 2) {
      log(`Ingresando numero: ${invoice.invoiceNumber}`);
      await page.locator(sel.cmpPuntoVenta).fill(parts[0]);
      await page.waitForTimeout(200);
      await page.locator(sel.cmpNumero).fill(parts[1]);
      await page.waitForTimeout(200);
    }
  }

  // Amount
  if (invoice.amount) {
    log(`Ingresando monto: $${invoice.amount}`);
    const montoField = page.locator(sel.cmpMontoFacturado);
    await montoField.click();
    await montoField.fill("");
    await montoField.pressSequentially(invoice.amount, { delay: 30 });
    await montoField.press("Tab");
    await page.waitForTimeout(500);
  }

  // Monto reintegrado: always 0
  const reintegrado = page.locator(sel.cmpMontoReintegrado);
  if (await reintegrado.isVisible().catch(() => false)) {
    await reintegrado.fill("0");
    await page.waitForTimeout(200);
  }

  // Click "Agregar" to add the comprobante to the list
  const agregarBtn = page.getByText("Agregar", { exact: true }).first();
  await agregarBtn.click();
  await page.waitForTimeout(1000);

  // Dismiss dialog overlay if it persists
  await dismissDialogOverlay(page);
}

/**
 * Dismiss any lingering jQuery UI dialog overlay that blocks the page.
 * SiRADIG's "Alta de Comprobante" dialog sometimes leaves the overlay
 * (`div.ui-widget-overlay`) visible after the dialog closes, blocking
 * clicks on buttons like Guardar.
 */
async function dismissDialogOverlay(page: Page): Promise<void> {
  // Wait briefly for the dialog to close naturally
  await page.waitForTimeout(500);

  // Remove any remaining overlays and close any open dialogs via jQuery
  await page.evaluate(() => {
    // Remove overlay elements
    document.querySelectorAll(".ui-widget-overlay").forEach((el) => el.remove());
    // Close any open jQuery UI dialogs
    try {
      (window as any).$(".ui-dialog-content").dialog("close");
    } catch {
      // No open dialogs, ignore
    }
  });
  await page.waitForTimeout(300);
}

/**
 * Map InvoiceType enum to SiRADIG's tipoComprobante select value.
 */
function mapInvoiceTypeToSiradigValue(invoiceType: string): string | null {
  const map: Record<string, string> = {
    FACTURA_A: "1",
    FACTURA_B: "6",
    FACTURA_C: "11",
    NOTA_DEBITO_A: "2",
    NOTA_DEBITO_B: "7",
    NOTA_DEBITO_C: "12",
    NOTA_CREDITO_A: "3",
    NOTA_CREDITO_B: "8",
    NOTA_CREDITO_C: "13",
    RECIBO: "4",
    TICKET: "83",
  };
  return map[invoiceType] ?? null;
}

// ── Domestic worker deduction ──────────────────────────────────────────────

export interface DomesticWorkerDeduction {
  cuil: string; // 11 digits, no dashes
  apellidoNombre: string;
  /** Monthly receipts to submit — each has contribution + salary amounts */
  months: Array<{
    fiscalMonth: number; // 1-12
    contributionAmount: string; // pago/contribucion amount
    contributionDate: string; // dd/mm/yyyy
    salaryAmount: string; // retribucion/salary amount
    salaryDate: string; // dd/mm/yyyy (payment date for salary)
  }>;
}

/**
 * Fill the "Deducción del Personal Doméstico" form in SiRADIG for one worker.
 *
 * Assumes the page is already on the F572 Web "Carga de Formulario" page
 * with the "3 - Deducciones y desgravaciones" accordion expanded.
 *
 * If an entry for this CUIL already exists, edits it (adds new monthly details).
 * Otherwise creates a new entry.
 */
export async function fillDomesticDeductionForm(
  page: Page,
  worker: DomesticWorkerDeduction,
  onLog?: (msg: string) => void,
  onScreenshot?: ScreenshotCallback,
): Promise<FillResult> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});
  const sel = ARCA_SELECTORS.siradigDomestico;

  try {
    // Check if an entry already exists for this CUIL in the domestic deductions table.
    // The table ID is dynamic (e.g., #nueva_tabla_deducciones8) so we find it by
    // the fieldset legend text "Deducción del Personal Doméstico".
    const existingRowIndex = await page.evaluate(
      ({ cuil }: { cuil: string }) => {
        const fieldsets = document.querySelectorAll("#div_tabla_deducciones_agrupadas fieldset");
        for (let f = 0; f < fieldsets.length; f++) {
          const legend = fieldsets[f].querySelector("legend");
          if (!legend || !legend.textContent?.toLowerCase().includes("personal doméstico"))
            continue;
          const rows = fieldsets[f].querySelectorAll("table tbody tr");
          for (let i = 0; i < rows.length; i++) {
            if ((rows[i].textContent || "").includes(cuil)) return { fieldsetIdx: f, rowIdx: i };
          }
        }
        return null;
      },
      { cuil: worker.cuil },
    );

    if (existingRowIndex) {
      // Edit existing entry — click the edit button on the matching row
      log(`Entrada existente encontrada para CUIL ${worker.cuil}. Editando...`);

      await page.evaluate(
        ({ fIdx, rIdx }: { fIdx: number; rIdx: number }) => {
          const fieldsets = document.querySelectorAll("#div_tabla_deducciones_agrupadas fieldset");
          const rows = fieldsets[fIdx].querySelectorAll("table tbody tr");
          const editBtn = rows[rIdx].querySelector("div.act_editar");
          if (editBtn) (editBtn as HTMLElement).click();
        },
        { fIdx: existingRowIndex.fieldsetIdx, rIdx: existingRowIndex.rowIdx },
      );

      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(2_000);
    } else {
      // Create new entry via the "Agregar" dropdown
      log("No hay entrada existente. Creando nueva deduccion domestica...");

      const addDeductionToggle = page.locator("#btn_agregar_deducciones");
      await addDeductionToggle.waitFor({ state: "visible", timeout: 10_000 });
      await addDeductionToggle.click();
      await page.waitForTimeout(500);

      const domesticoLink = page.locator("#link_agregar_personal_domestico");
      await domesticoLink.waitFor({ state: "visible", timeout: 5_000 });
      await domesticoLink.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1_000);

      // Fill CUIL — after Tab, SiRADIG does an AJAX lookup that
      // auto-fills the readonly #razonSocial field with the worker's name.
      log(`Ingresando CUIL: ${worker.cuil}`);
      const cuitField = page.locator(sel.formCuit);
      await cuitField.waitFor({ state: "visible", timeout: 10_000 });
      await cuitField.click();
      await cuitField.fill(worker.cuil);
      await cuitField.press("Tab");

      // Wait for AJAX to populate the name field
      const nombreField = page.locator(sel.formApellidoNombre);
      await nombreField.waitFor({ state: "visible", timeout: 10_000 });
      try {
        await page.waitForFunction(
          (s: string) => {
            const el = document.querySelector(s) as HTMLInputElement | null;
            return el && el.value.trim().length > 0;
          },
          sel.formApellidoNombre,
          { timeout: 10_000 },
        );
        const name = await nombreField.inputValue();
        log(`Nombre auto-completado: ${name}`);
      } catch {
        log("Nombre no se auto-completo, continuando...");
      }
      await page.waitForTimeout(300);
    }

    await capture(
      await page.screenshot({ fullPage: true }),
      `domestic-form-${worker.cuil}`,
      `Formulario deduccion domestica - CUIL ${worker.cuil}`,
    );

    // Add monthly payment details
    await addMonthlyDetails(page, worker.months, log);

    await capture(
      await page.screenshot({ fullPage: true }),
      `domestic-form-filled-${worker.cuil}`,
      `Formulario domestico completo - CUIL ${worker.cuil}`,
    );

    log("Formulario de deduccion domestica listo para guardar");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error al completar formulario domestico: ${msg}`);
    await capture(
      await page.screenshot({ fullPage: true }),
      `domestic-form-error-${worker.cuil}`,
      `Error en formulario domestico - CUIL ${worker.cuil}`,
    );
    return { success: false, error: msg };
  }
}

/**
 * Add monthly payment details to an open domestic deduction form.
 * Used by both the "new entry" and "edit existing" paths.
 */
async function addMonthlyDetails(
  page: Page,
  months: DomesticWorkerDeduction["months"],
  log: (msg: string) => void,
): Promise<void> {
  const sel = ARCA_SELECTORS.siradigDomestico;
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

  for (const m of months) {
    log(`Agregando detalle de pago: ${monthNames[m.fiscalMonth] || m.fiscalMonth}...`);

    // Click "Agregar Detalle de Pagos"
    const addDetailBtn = page.locator(sel.agregarDetalleBtn).first();
    await addDetailBtn.waitFor({ state: "visible", timeout: 5_000 });
    await addDetailBtn.click();
    await page.waitForTimeout(1_000);

    // Wait for the dialog to open
    const mesSelect = page.locator(sel.detalleMes);
    await mesSelect.waitFor({ state: "visible", timeout: 5_000 });

    // Select month
    await mesSelect.selectOption(String(m.fiscalMonth));
    await page.waitForTimeout(300);

    // Fill all fields via jQuery to avoid datepicker popups intercepting clicks.
    await page.evaluate(
      (data: {
        contribMonto: string;
        contribFecha: string;
        retribMonto: string;
        retribFecha: string;
      }) => {
        const $ = (window as any).$;
        $("#pagoMontoContribucion").val(data.contribMonto).trigger("change");
        $("#pagoFechaContribucion").val(data.contribFecha).trigger("change");
        $("#pagoMontoRetribucion").val(data.retribMonto).trigger("change");
        $("#pagoFechaRetribucion").val(data.retribFecha).trigger("change");
        // Dismiss any open datepicker
        $.datepicker._hideDatepicker();
      },
      {
        contribMonto: m.contributionAmount,
        contribFecha: m.contributionDate,
        retribMonto: m.salaryAmount,
        retribFecha: m.salaryDate,
      },
    );
    await page.waitForTimeout(300);

    // Click "Agregar" in the dialog
    const agregarBtn = page.locator(sel.detalleAgregarBtn);
    await agregarBtn.waitFor({ state: "visible", timeout: 5_000 });
    await agregarBtn.click();
    await page.waitForTimeout(1_000);

    // Dismiss any lingering dialog overlay
    await dismissDialogOverlay(page);

    log(`Detalle de pago ${monthNames[m.fiscalMonth]} agregado`);
  }
}

// ─── SiRADIG Deduction Extraction ─────────────────────────────────────────

/** A single comprobante extracted from a deduction edit form */
export interface ExtractedComprobante {
  fechaEmision: string; // DD/MM/YYYY
  tipo: string; // SiRADIG display text (e.g., "Factura B")
  tipoEnum?: string; // InvoiceType enum (e.g., "FACTURA_B")
  puntoVenta: string;
  numero: string;
  montoFacturado: string;
  montoReintegrado: string;
}

/** Extracted data for a standard deduction entry (Gastos Médicos, Indumentaria, etc.) */
export interface ExtractedDeduction {
  category: string; // DeductionCategory enum
  providerCuit: string;
  providerName: string;
  periodoDesde: number; // 1-12
  periodoHasta: number; // 1-12
  montoTotal: string;
  comprobantes: ExtractedComprobante[];
  /** For GASTOS_EDUCATIVOS: name of the family dependent */
  familiarName?: string;
}

/** Extracted data for an alquiler entry */
export interface ExtractedAlquilerDeduction {
  category: "ALQUILER_VIVIENDA";
  providerCuit: string;
  providerName: string;
  contractStartDate?: string; // DD/MM/YYYY
  contractEndDate?: string; // DD/MM/YYYY
  months: Array<{
    month: number; // 1-12
    amount: string;
  }>;
  comprobantes: ExtractedComprobante[];
}

/** Extracted data for a domestic worker deduction */
export interface ExtractedDomesticoDeduction {
  category: "SERVICIO_DOMESTICO";
  workerCuil: string;
  workerName: string;
  periodoDesde: number;
  periodoHasta: number;
  montoTotal: string;
  monthlyDetails: Array<{
    month: number; // 1-12
    contributionAmount: string;
    contributionDate: string; // DD/MM/YYYY
    salaryAmount: string;
    salaryDate: string; // DD/MM/YYYY
  }>;
}

export type ExtractedEntry =
  | ExtractedDeduction
  | ExtractedAlquilerDeduction
  | ExtractedDomesticoDeduction;

/**
 * Parse a SiRADIG amount string to a clean decimal string.
 *
 * SiRADIG uses two formats:
 * - Comprobantes table:  "524399.00"  (dot = decimal)
 * - Form fields:         "524399,00"  (comma = decimal, Argentine locale)
 *
 * SiRADIG never uses dots as thousands separators, so dots are always decimal.
 */
export function parseSiradigAmount(raw: string): string {
  const cleaned = raw.replace(/[$\s]/g, "").trim();
  if (!cleaned) return "0";
  // If it has a comma, treat comma as decimal (Argentine format)
  if (cleaned.includes(",")) {
    return cleaned.replace(/\./g, "").replace(",", ".");
  }
  // Otherwise the dot is already the decimal separator
  return cleaned;
}

// Month name → month number reverse lookup
const MONTH_NAME_TO_NUM: Record<string, number> = {};
for (let i = 1; i <= 12; i++) {
  MONTH_NAME_TO_NUM[MONTH_NAMES[i].toLowerCase()] = i;
}

/**
 * Parse a SiRADIG month string (e.g., "Enero", "01", "1", "01 - Enero") to a month number.
 */
export function parseMonthValue(text: string): number {
  const trimmed = text.trim().toLowerCase();
  // Try direct name match
  if (MONTH_NAME_TO_NUM[trimmed]) return MONTH_NAME_TO_NUM[trimmed];
  // Try "01 - Enero" format
  for (const [name, num] of Object.entries(MONTH_NAME_TO_NUM)) {
    if (trimmed.includes(name)) return num;
  }
  // Try numeric
  const num = parseInt(trimmed, 10);
  if (num >= 1 && num <= 12) return num;
  return 0;
}

/**
 * Extract all existing deductions from SiRADIG's "Deducciones y desgravaciones" section.
 *
 * The page must already be on the "Carga de Formulario" view with the
 * "Deducciones y desgravaciones" accordion expanded (call `navigateToDeductionSection()` first).
 *
 * For each category fieldset, iterates rows, clicks edit to extract full details,
 * then clicks "Volver" to return to the list.
 *
 * @param categories - Set of DeductionCategory enum values to extract. Unmatched categories are skipped.
 */
export async function extractSiradigDeductions(
  page: Page,
  categories: Set<string>,
  onLog?: (msg: string) => void,
  onScreenshot?: ScreenshotCallback,
): Promise<ExtractedEntry[]> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});
  const sel = ARCA_SELECTORS.siradigEdit;
  const results: ExtractedEntry[] = [];

  // Enumerate all fieldsets in the deductions container
  const fieldsetCount = await page
    .locator(`${sel.deductionsContainer} ${sel.fieldsetSelector}`)
    .count();

  log(`Encontrados ${fieldsetCount} secciones de deducciones`);

  for (let f = 0; f < fieldsetCount; f++) {
    const fieldset = page.locator(`${sel.deductionsContainer} ${sel.fieldsetSelector}`).nth(f);
    const legendText = (await fieldset.locator("legend").textContent()) ?? "";
    const category = reverseLookupCategory(legendText);

    if (!category || !categories.has(category)) {
      if (category) {
        log(`Saltando categoría no solicitada: ${legendText}`);
      } else if (legendText.trim()) {
        log(`Categoría no reconocida: ${legendText}`);
      }
      continue;
    }

    const rows = fieldset.locator(sel.listRow);
    const rowCount = await rows.count();

    if (rowCount === 0) {
      log(`${legendText}: sin entradas, saltando`);
      continue;
    }

    log(`${legendText}: ${rowCount} entrada(s) encontrada(s)`);

    for (let r = 0; r < rowCount; r++) {
      log(`${legendText}: leyendo entrada ${r + 1}/${rowCount}...`);

      try {
        // Click edit on this row. Some categories trigger AJAX, others cause
        // full-page navigation — use Promise.all to handle both cases.
        await Promise.all([
          page.waitForLoadState("networkidle").catch(() => {}),
          page
            .evaluate(
              ({ containerSel, fieldsetSel, editBtnSel, fIdx, rIdx, rowSel }) => {
                const fieldsets = document
                  .querySelector(containerSel)!
                  .querySelectorAll(fieldsetSel);
                const theRows = fieldsets[fIdx].querySelectorAll(rowSel);
                const editBtn = theRows[rIdx].querySelector(editBtnSel);
                if (editBtn) (editBtn as HTMLElement).click();
              },
              {
                containerSel: sel.deductionsContainer as string,
                fieldsetSel: sel.fieldsetSelector as string,
                editBtnSel: sel.editButton as string,
                rowSel: sel.listRow as string,
                fIdx: f,
                rIdx: r,
              },
            )
            .catch(() => {
              // page.evaluate may fail if the click triggers navigation
              // that destroys the execution context — this is expected
            }),
        ]);
        await page.waitForTimeout(2000);

        // Extract based on category type
        let entry: ExtractedEntry | null = null;

        if (category === "ALQUILER_VIVIENDA") {
          entry = await extractAlquilerEditForm(page, log);
        } else if (category === "SERVICIO_DOMESTICO") {
          entry = await extractDomesticoEditForm(page, log);
        } else {
          entry = await extractStandardEditForm(page, category, log);
        }

        if (entry) {
          results.push(entry);
        }

        await capture(
          await page.screenshot({ fullPage: true }),
          `extract-${category.toLowerCase()}-${r + 1}`,
          `Extraída entrada ${r + 1} de ${legendText}`,
        );

        // Click "Volver" to return to the list view
        const volverBtn = page.locator(sel.editVolverBtn);
        await volverBtn.waitFor({ state: "visible", timeout: 10_000 });
        await Promise.all([
          page.waitForLoadState("networkidle").catch(() => {}),
          volverBtn.click(),
        ]);
        await page.waitForTimeout(2000);

        // Re-expand deductions accordion if it collapsed after Volver
        const isExpanded = await page
          .locator(sel.deductionsContainer)
          .isVisible()
          .catch(() => false);
        if (!isExpanded) {
          log("Re-expandiendo sección de deducciones...");
          const deductionsHeader = page.getByText("Deducciones y desgravaciones").first();
          await deductionsHeader.waitFor({ state: "visible", timeout: 10_000 });
          await deductionsHeader.click();
          await page.waitForLoadState("networkidle").catch(() => {});
          await page.waitForTimeout(1000);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        log(`Error extrayendo entrada ${r + 1} de ${legendText}: ${msg}`);
        // Try to recover by going back
        try {
          const volverBtn = page.locator(sel.editVolverBtn);
          if (await volverBtn.isVisible().catch(() => false)) {
            await volverBtn.click();
            await page.waitForLoadState("networkidle").catch(() => {});
            await page.waitForTimeout(1500);
          }
        } catch {
          /* recovery failed, continue */
        }
      }
    }
  }

  log(`Extracción completada: ${results.length} entradas extraídas`);
  return results;
}

/**
 * Extract data from a standard deduction edit form (Gastos Médicos, Indumentaria, etc.).
 * Assumes the edit form is already open.
 */
async function extractStandardEditForm(
  page: Page,
  category: string,
  log: (msg: string) => void,
): Promise<ExtractedDeduction | null> {
  const sel = ARCA_SELECTORS.siradigEdit;

  // Wait for the edit form to fully load (CUIT field gets populated via AJAX).
  // Note: CSS [value] checks the HTML attribute, not the JS property.
  // SiRADIG populates values via JS, so use evaluate to check the DOM property.
  try {
    await page.waitForFunction(`document.querySelector("${sel.editCuit}")?.value?.length > 0`, {
      timeout: 10_000,
    });
  } catch {
    log("  Formulario de edición no cargó el CUIT, saltando entrada");
    return null;
  }

  // Read main form fields
  const formData = await page.evaluate(
    (selectors) => {
      const getValue = (id: string) =>
        (document.querySelector(id) as HTMLInputElement)?.value ?? "";
      const getSelectOrInputText = (id: string) => {
        const el = document.querySelector(id) as HTMLElement | null;
        if (!el) return "";
        // Handle both <select> and <input> elements
        if (el.tagName === "SELECT") {
          const sel = el as HTMLSelectElement;
          return sel.selectedIndex >= 0
            ? (sel.options[sel.selectedIndex]?.text ?? sel.value)
            : sel.value;
        }
        return (el as HTMLInputElement).value ?? "";
      };

      return {
        cuit: getValue(selectors.editCuit),
        denominacion: getValue(selectors.editDenominacion),
        periodoDesde: getSelectOrInputText(selectors.editPeriodo),
        montoTotal: getValue(selectors.editMontoTotal),
      };
    },
    {
      editCuit: sel.editCuit as string,
      editDenominacion: sel.editDenominacion as string,
      editPeriodo: sel.editPeriodo as string,
      editMontoTotal: sel.editMontoTotal as string,
    },
  );

  // Also try to read periodoHasta if it exists (may be <select> or <input>)
  const periodoHasta = await page.evaluate(() => {
    const el = document.querySelector("#mesHasta") as HTMLElement | null;
    if (!el) return "";
    if (el.tagName === "SELECT") {
      const sel = el as HTMLSelectElement;
      return sel.selectedIndex >= 0
        ? (sel.options[sel.selectedIndex]?.text ?? sel.value)
        : sel.value;
    }
    return (el as HTMLInputElement).value ?? "";
  });

  // For GASTOS_EDUCATIVOS, try to read the familiar (dependent) name
  // Verified via agent-browser on 2026-03-26: the dependent name is in #apellidoNombreFam
  let familiarName: string | undefined;
  if (category === "GASTOS_EDUCATIVOS") {
    familiarName = await page.evaluate(() => {
      // Primary: #apellidoNombreFam contains "APELLIDO, NOMBRE" of the dependent
      const nameInput = document.querySelector("#apellidoNombreFam") as HTMLInputElement;
      if (nameInput?.value) return nameInput.value;
      // Fallback: try select-based familiar fields
      const familiarEl =
        (document.querySelector("#familiar") as HTMLSelectElement) ??
        (document.querySelector("#idFamiliar") as HTMLSelectElement);
      if (familiarEl?.tagName === "SELECT" && familiarEl.selectedIndex >= 0) {
        return familiarEl.options[familiarEl.selectedIndex]?.text ?? undefined;
      }
      return undefined;
    });
  }

  // Extract comprobantes from sub-table
  const comprobantes = await extractComprobantesTable(page);

  const desdeNum = parseMonthValue(formData.periodoDesde);
  const hastaNum = periodoHasta ? parseMonthValue(periodoHasta) : desdeNum;

  log(
    `  CUIT: ${formData.cuit}, Denominación: ${formData.denominacion}, ` +
      `Periodo: ${formData.periodoDesde}${periodoHasta ? ` - ${periodoHasta}` : ""}, ` +
      `Monto: ${formData.montoTotal}, Comprobantes: ${comprobantes.length}`,
  );

  return {
    category,
    providerCuit: formData.cuit,
    providerName: formData.denominacion,
    periodoDesde: desdeNum,
    periodoHasta: hastaNum || desdeNum,
    montoTotal: formData.montoTotal,
    comprobantes,
    familiarName,
  };
}

/**
 * Extract data from an ALQUILER_VIVIENDA edit form.
 * Reads contract dates and monthly detail rows from #tabla_meses.
 */
async function extractAlquilerEditForm(
  page: Page,
  log: (msg: string) => void,
): Promise<ExtractedAlquilerDeduction | null> {
  const sel = ARCA_SELECTORS.siradigEdit;

  // Wait for the edit form to fully load (CUIT field gets populated via AJAX)
  try {
    await page.waitForFunction(`document.querySelector("${sel.editCuit}")?.value?.length > 0`, {
      timeout: 10_000,
    });
  } catch {
    log("  Alquiler: formulario de edición no cargó el CUIT, saltando entrada");
    return null;
  }

  // Read main form fields (locador CUIT, name, contract dates)
  const formData = await page.evaluate(
    (selectors) => {
      const getValue = (id: string) =>
        (document.querySelector(id) as HTMLInputElement)?.value ?? "";

      return {
        cuit: getValue(selectors.editCuit),
        denominacion: getValue(selectors.editDenominacion),
        contractStart: getValue("#fechaVigenciaDesde"),
        contractEnd: getValue("#fechaVigenciaHasta"),
      };
    },
    { editCuit: sel.editCuit as string, editDenominacion: sel.editDenominacion as string },
  );

  // Extract monthly amounts from #tabla_meses
  // Columns: Mes | Monto Tope (deductible cap) | Monto Comprobantes Ingresados (actual rent) | Actions
  // We want "Monto Comprobantes Ingresados" (cells[2]) — the actual rent paid,
  // not "Monto Tope" (cells[1]) which is the 40% deductible cap calculated by SiRADIG.
  const months = await page.evaluate(() => {
    const table = document.querySelector("#tabla_meses");
    if (!table) return [];
    const rows = table.querySelectorAll("tbody tr");
    const result: Array<{ monthText: string; amount: string }> = [];
    for (let i = 0; i < rows.length; i++) {
      const cells = Array.from(rows[i].querySelectorAll("td"));
      if (cells.length >= 3) {
        result.push({
          monthText: cells[0].textContent?.trim() ?? "",
          amount: cells[2].textContent?.trim() ?? "",
        });
      }
    }
    return result;
  });

  const parsedMonths = months
    .map((m) => ({
      month: parseMonthValue(m.monthText),
      amount: parseSiradigAmount(m.amount),
    }))
    .filter((m) => m.month > 0);

  // Extract comprobantes
  const comprobantes = await extractComprobantesTable(page);

  log(
    `  Alquiler — CUIT: ${formData.cuit}, Denominación: ${formData.denominacion}, ` +
      `Vigencia: ${formData.contractStart} - ${formData.contractEnd}, ` +
      `Meses: ${parsedMonths.length}, Comprobantes: ${comprobantes.length}`,
  );

  return {
    category: "ALQUILER_VIVIENDA",
    providerCuit: formData.cuit,
    providerName: formData.denominacion,
    contractStartDate: formData.contractStart || undefined,
    contractEndDate: formData.contractEnd || undefined,
    months: parsedMonths,
    comprobantes,
  };
}

/**
 * Extract data from a SERVICIO_DOMESTICO edit form.
 * Reads worker CUIL, name, period, and monthly payment details.
 */
async function extractDomesticoEditForm(
  page: Page,
  log: (msg: string) => void,
): Promise<ExtractedDomesticoDeduction | null> {
  const domSel = ARCA_SELECTORS.siradigDomestico;

  // Wait for the edit form to fully load (CUIL field gets populated via AJAX)
  try {
    await page.waitForFunction(`document.querySelector("${domSel.formCuit}")?.value?.length > 0`, {
      timeout: 10_000,
    });
  } catch {
    log("  Formulario doméstico no cargó el CUIL, saltando entrada");
    return null;
  }

  const formData = await page.evaluate(
    (selectors) => {
      const getValue = (id: string) =>
        (document.querySelector(id) as HTMLInputElement)?.value ?? "";
      const getSelectOrInputText = (id: string) => {
        const el = document.querySelector(id) as HTMLElement | null;
        if (!el) return "";
        if (el.tagName === "SELECT") {
          const s = el as HTMLSelectElement;
          return s.selectedIndex >= 0 ? (s.options[s.selectedIndex]?.text ?? s.value) : s.value;
        }
        return (el as HTMLInputElement).value ?? "";
      };

      return {
        cuil: getValue(selectors.formCuit),
        name: getValue(selectors.formApellidoNombre),
        mesDesde: getSelectOrInputText(selectors.formMesDesde),
        mesHasta: getSelectOrInputText(selectors.formMesHasta),
        montoTotal: getValue(selectors.formMontoTotal),
      };
    },
    {
      formCuit: domSel.formCuit as string,
      formApellidoNombre: domSel.formApellidoNombre as string,
      formMesDesde: domSel.formMesDesde as string,
      formMesHasta: domSel.formMesHasta as string,
      formMontoTotal: domSel.formMontoTotal as string,
    },
  );

  // Extract monthly detail rows from the detail table
  // Verified via agent-browser on 2026-03-26: table ID is #tabla_pagos
  const monthlyDetails = await page.evaluate(() => {
    const table =
      document.querySelector("#tabla_pagos") ??
      document.querySelector("#tabla_detalle_pagos") ??
      document.querySelector("#tabla_detalles");

    if (!table) return [];

    const rows = table.querySelectorAll("tbody tr");
    const result: Array<{
      monthText: string;
      contribAmount: string;
      contribDate: string;
      salaryAmount: string;
      salaryDate: string;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const cells = Array.from(rows[i].querySelectorAll("td"));
      if (cells.length >= 5) {
        result.push({
          monthText: cells[0].textContent?.trim() ?? "",
          contribAmount: cells[1].textContent?.trim() ?? "",
          contribDate: cells[2].textContent?.trim() ?? "",
          salaryAmount: cells[3].textContent?.trim() ?? "",
          salaryDate: cells[4].textContent?.trim() ?? "",
        });
      }
    }
    return result;
  });

  const parsedDetails = monthlyDetails
    .map((d) => ({
      month: parseMonthValue(d.monthText),
      contributionAmount: parseSiradigAmount(d.contribAmount),
      contributionDate: d.contribDate,
      salaryAmount: parseSiradigAmount(d.salaryAmount),
      salaryDate: d.salaryDate,
    }))
    .filter((d) => d.month > 0);

  log(
    `  Doméstico — CUIL: ${formData.cuil}, Nombre: ${formData.name}, ` +
      `Periodo: ${formData.mesDesde} - ${formData.mesHasta}, ` +
      `Monto total: ${formData.montoTotal}, Meses con detalle: ${parsedDetails.length}`,
  );

  return {
    category: "SERVICIO_DOMESTICO",
    workerCuil: formData.cuil.replace(/[-\s]/g, ""),
    workerName: formData.name,
    periodoDesde: parseMonthValue(formData.mesDesde),
    periodoHasta: parseMonthValue(formData.mesHasta),
    montoTotal: formData.montoTotal,
    monthlyDetails: parsedDetails,
  };
}

/**
 * Extract comprobantes from the #tabla_comprobantes sub-table in the current edit form.
 *
 * Column layouts vary by category:
 * - Standard (Gastos Médicos): Fecha | Tipo | Número | Monto | Monto Reintegrado | (actions)
 * - Indumentaria:              Fecha | Tipo | Número | Monto | (actions)
 * - Primas de Seguro:          Asociado a | Fecha | Tipo | Número | Monto | (actions)
 *
 * We detect the layout by reading the header row.
 */
async function extractComprobantesTable(page: Page): Promise<ExtractedComprobante[]> {
  const sel = ARCA_SELECTORS.siradigEdit;

  const tableData = await page.evaluate((tableSelector) => {
    const table = document.querySelector(tableSelector);
    if (!table) return { headers: [] as string[], rows: [] as string[][] };
    const headers = Array.from(table.querySelectorAll("thead th")).map(
      (th) => th.textContent?.trim() ?? "",
    );
    const rows = Array.from(table.querySelectorAll("tbody tr")).map((tr) =>
      Array.from(tr.querySelectorAll("td")).map((td) => td.textContent?.trim() ?? ""),
    );
    return { headers, rows };
  }, sel.comprobantesTable as string);

  const { headers, rows } = tableData;
  if (rows.length === 0) return [];

  // Detect column indices from headers (case-insensitive)
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  const fechaIdx = lowerHeaders.findIndex((h) => h.includes("fecha"));
  const tipoIdx = lowerHeaders.findIndex((h) => h.includes("tipo"));
  const numIdx = lowerHeaders.findIndex((h) => h.includes("número") || h.includes("numero"));
  const montoIdx = lowerHeaders.findIndex(
    (h) =>
      h === "monto" || h === "monto facturado" || (h.includes("monto") && !h.includes("reint")),
  );
  const reintIdx = lowerHeaders.findIndex((h) => h.includes("reint"));

  return rows
    .filter((cells) => cells.length >= 3)
    .map((cells) => {
      const tipo = tipoIdx >= 0 ? (cells[tipoIdx] ?? "") : "";
      // Parse combined number column: "00004 - 00001074" or just "378874"
      const numeroCombined = numIdx >= 0 ? (cells[numIdx] ?? "") : "";
      const numParts = numeroCombined.split(/\s*-\s*/);
      const puntoVenta = numParts.length > 1 ? (numParts[0]?.trim() ?? "") : "";
      const numero = numParts.length > 1 ? (numParts[1]?.trim() ?? "") : numeroCombined.trim();

      const montoRaw = montoIdx >= 0 ? (cells[montoIdx] ?? "") : "";
      const reintRaw = reintIdx >= 0 ? (cells[reintIdx] ?? "") : "";

      return {
        fechaEmision: fechaIdx >= 0 ? (cells[fechaIdx] ?? "") : "",
        tipo,
        tipoEnum: reverseLookupInvoiceType(tipo),
        puntoVenta,
        numero,
        montoFacturado: parseSiradigAmount(montoRaw),
        montoReintegrado: parseSiradigAmount(reintRaw),
      };
    });
}

/** Check if an extracted entry is an alquiler deduction */
export function isAlquilerExtraction(entry: ExtractedEntry): entry is ExtractedAlquilerDeduction {
  return entry.category === "ALQUILER_VIVIENDA";
}

/** Check if an extracted entry is a domestic worker deduction */
export function isDomesticoExtraction(entry: ExtractedEntry): entry is ExtractedDomesticoDeduction {
  return entry.category === "SERVICIO_DOMESTICO";
}

/** Check if an extracted entry is a standard deduction */
export function isStandardExtraction(entry: ExtractedEntry): entry is ExtractedDeduction {
  return !isAlquilerExtraction(entry) && !isDomesticoExtraction(entry);
}
