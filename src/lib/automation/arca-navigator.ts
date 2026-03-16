import { Page } from "playwright";
import { ARCA_SELECTORS } from "./selectors";

export interface LoginResult {
  success: boolean;
  error?: string;
  hasCaptcha?: boolean;
}

export type ScreenshotCallback = (buffer: Buffer, slug: string, label: string) => Promise<void>;

export async function loginToArca(
  page: Page,
  cuit: string,
  clave: string,
  onLog?: (msg: string) => void,
  onScreenshot?: ScreenshotCallback,
): Promise<LoginResult> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});
  const sel = ARCA_SELECTORS.login;

  try {
    log("Navegando a la pagina de login de ARCA...");
    await page.goto(sel.url, { waitUntil: "domcontentloaded" });
    log(`URL cargada: ${page.url()}`);
    await page.locator(sel.cuitInput).waitFor({ state: "visible", timeout: 30_000 });

    await capture(await page.screenshot({ fullPage: true }), "login-page", "Pagina de login ARCA");

    // Check for CAPTCHA
    const captcha = await page.$(sel.captchaContainer);
    if (captcha) {
      await capture(
        await page.screenshot({ fullPage: true }),
        "captcha-detected",
        "CAPTCHA detectado",
      );
      log("CAPTCHA detectado. Se requiere intervencion manual.");
      return { success: false, error: "CAPTCHA detectado", hasCaptcha: true };
    }

    // Enter CUIT
    log("Ingresando CUIT...");
    await page.fill(sel.cuitInput, cuit);
    await page.click(sel.cuitSubmit);

    // Wait for password field (CUIT submit may trigger full navigation or AJAX update)
    log("Esperando campo de clave fiscal...");
    await page.locator(sel.claveInput).waitFor({ state: "visible", timeout: 30_000 });
    log(`URL despues de CUIT: ${page.url()}`);

    await capture(await page.screenshot({ fullPage: true }), "after-cuit", "CUIT ingresado");

    // Enter password
    log("Ingresando clave fiscal...");
    await page.fill(sel.claveInput, clave);
    await page.click(sel.loginSubmit);

    // Wait for navigation away from login pages (login.xhtml → loginClave.xhtml → portal)
    try {
      await page.waitForURL((url) => !url.toString().includes("/contribuyente_/"), {
        timeout: 30_000,
      });
      await page.waitForLoadState("load");
    } catch {
      log(`Redireccion post-login no detectada. URL actual: ${page.url()}`);
    }

    log(`URL despues de login: ${page.url()}`);

    // Check for errors
    const errorEl = await page.$(sel.errorMessage);
    if (errorEl) {
      const errorText = await errorEl.textContent();
      await capture(await page.screenshot({ fullPage: true }), "login-error", "Error de login");
      log(`Error de login: ${errorText}`);
      return {
        success: false,
        error: errorText?.trim() || "Error de autenticacion",
      };
    }

    // Verify we're logged in (URL should change from login page)
    const currentUrl = page.url();
    if (currentUrl.includes("login")) {
      await capture(await page.screenshot({ fullPage: true }), "login-stuck", "Login atascado");
      log(`Login fallido: sigue en la pagina de login (${currentUrl})`);
      return { success: false, error: "Login fallido" };
    }

    await capture(await page.screenshot({ fullPage: true }), "login-success", "Login exitoso");

    log("Login exitoso en ARCA");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error durante login: ${msg} | URL: ${page.url()}`);
    try {
      await capture(await page.screenshot({ fullPage: true }), "login-crash", "Error fatal login");
    } catch {
      /* screenshot may fail too */
    }
    return { success: false, error: msg };
  }
}

export async function navigateToSiradig(
  page: Page,
  onLog?: (msg: string) => void,
  onScreenshot?: ScreenshotCallback,
): Promise<Page | null> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});

  try {
    // Navigate to "Ver todos" (full services list) — don't rely on the service
    // appearing in the "Más utilizados" tiles on the portal home page.
    const allServicesUrl = "https://portalcf.cloud.afip.gob.ar/portal/app/mis-servicios";
    log('Navegando a "Ver todos" (lista completa de servicios)...');
    await page.goto(allServicesUrl, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    log(`Pagina de servicios cargada: ${page.url()}`);

    await capture(
      await page.screenshot({ fullPage: true }),
      "portal-all-services",
      "Lista completa de servicios ARCA",
    );

    // Use the search combobox (react-bootstrap-typeahead) to find the service.
    // Filling the input opens a dropdown (#resBusqueda) with matching options;
    // clicking the option triggers SSO navigation and opens the service in a new tab.
    log('Buscando servicio "SiRADIG - Trabajador"...');
    const searchInput = page.locator(ARCA_SELECTORS.portal.searchService);
    await searchInput.waitFor({ state: "visible", timeout: 10_000 });
    await searchInput.fill("SiRADIG");

    // Wait for the typeahead dropdown to appear with matching results
    const dropdown = page.locator(ARCA_SELECTORS.portal.searchResultsList);
    await dropdown.waitFor({ state: "visible", timeout: 10_000 });

    const siradigOption = dropdown
      .locator(ARCA_SELECTORS.portal.searchResultOption)
      .filter({ hasText: "SiRADIG - Trabajador" });
    await siradigOption.waitFor({ state: "visible", timeout: 5_000 });

    // Clicking the dropdown option opens the service in a new tab via SSO
    log("Accediendo a SiRADIG - Trabajador...");
    const [siradigPage] = await Promise.all([
      page.context().waitForEvent("page", { timeout: 15_000 }),
      siradigOption.click(),
    ]);
    await siradigPage.waitForLoadState("domcontentloaded");
    log(`SiRADIG URL: ${siradigPage.url()}`);

    await capture(
      await siradigPage.screenshot({ fullPage: true }),
      "siradig-loaded",
      "SiRADIG cargado",
    );

    log("SiRADIG cargado correctamente (nueva pestaña)");
    return siradigPage;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error navegando a SiRADIG: ${msg} | URL: ${page.url()}`);
    try {
      await capture(
        await page.screenshot({ fullPage: true }),
        "siradig-error",
        "Error navegando a SiRADIG",
      );
    } catch {
      /* screenshot may fail too */
    }
    return null;
  }
}
