import { Page } from "playwright";
import { ARCA_SELECTORS } from "./selectors";

export interface LoginResult {
  success: boolean;
  error?: string;
  hasCaptcha?: boolean;
}

export async function loginToArca(
  page: Page,
  cuit: string,
  clave: string,
  onLog?: (msg: string) => void,
): Promise<LoginResult> {
  const log = onLog ?? (() => {});
  const sel = ARCA_SELECTORS.login;

  try {
    // Check if there's an existing valid session by navigating to the portal.
    // If the session is alive (cookies from a previous job in the same context),
    // the portal loads directly. If not, it redirects to the login page.
    log("Verificando sesion existente...");
    const portalUrl = "https://portalcf.cloud.afip.gob.ar/portal/app/";
    await page.goto(portalUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForLoadState("load").catch(() => {});

    const portalCheckUrl = page.url();
    if (portalCheckUrl.includes("portalcf.cloud.afip.gob.ar/portal/app")) {
      // Check if the search bar is present (portal is actually loaded, not redirecting)
      const searchBar = page.locator(ARCA_SELECTORS.portal.searchService);
      const isLoggedIn = await searchBar
        .waitFor({ state: "visible", timeout: 3_000 })
        .then(() => true)
        .catch(() => false);
      if (isLoggedIn) {
        log("Sesion ARCA existente reutilizada");
        return { success: true };
      }
    }

    // No valid session — perform full login
    log("Navegando a la pagina de login de ARCA...");
    await page.goto(sel.url, { waitUntil: "domcontentloaded" });
    log(`URL cargada: ${page.url()}`);
    await page.locator(sel.cuitInput).waitFor({ state: "visible", timeout: 30_000 });

    // Check for CAPTCHA
    const captcha = await page.$(sel.captchaContainer);
    if (captcha) {
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
      log(`Error de login: ${errorText}`);
      return {
        success: false,
        error: errorText?.trim() || "Error de autenticacion",
      };
    }

    // Verify we're logged in (URL should change from login page)
    const currentUrl = page.url();
    if (currentUrl.includes("login")) {
      log(`Login fallido: sigue en la pagina de login (${currentUrl})`);
      return { success: false, error: "Login fallido" };
    }

    log("Login exitoso en ARCA");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error durante login: ${msg} | URL: ${page.url()}`);
    return { success: false, error: msg };
  }
}

/**
 * Search for a service in the ARCA portal's navbar search bar and open it in a new tab.
 *
 * The portal's react-bootstrap-typeahead search bar (#buscadorInput) is present in the
 * top navbar on every portal page. We search directly from the current page instead of
 * navigating to "/mis-servicios" first, saving one full page load per service access.
 *
 * If the search bar is not visible (e.g., unexpected redirect), falls back to navigating
 * to "/mis-servicios" where the same search bar is guaranteed to be available.
 */
export async function searchAndOpenService(
  page: Page,
  searchText: string,
  optionText: string,
  onLog: (msg: string) => void,
): Promise<Page> {
  const searchInput = page.locator(ARCA_SELECTORS.portal.searchService);

  // Try the search bar on the current page first (fast path)
  const searchBarVisible = await searchInput
    .waitFor({ state: "visible", timeout: 3_000 })
    .then(() => true)
    .catch(() => false);

  if (!searchBarVisible) {
    // Fallback: navigate to "/mis-servicios" where the search bar is guaranteed
    const allServicesUrl = "https://portalcf.cloud.afip.gob.ar/portal/app/mis-servicios";
    onLog("Buscador no visible, navegando a lista de servicios...");
    await page.goto(allServicesUrl, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    await searchInput.waitFor({ state: "visible", timeout: 10_000 });
  }

  // Clear any previous search text and type the service name
  onLog(`Buscando servicio "${optionText}"...`);
  await searchInput.clear();
  await searchInput.fill(searchText);

  // Wait for the typeahead dropdown to appear with matching results
  const dropdown = page.locator(ARCA_SELECTORS.portal.searchResultsList);
  await dropdown.waitFor({ state: "visible", timeout: 10_000 });

  const option = dropdown
    .locator(ARCA_SELECTORS.portal.searchResultOption)
    .filter({ hasText: optionText });
  await option.waitFor({ state: "visible", timeout: 5_000 });

  // Clicking the dropdown option opens the service in a new tab via SSO
  onLog(`Abriendo servicio "${optionText}"...`);
  const [newTab] = await Promise.all([
    page.context().waitForEvent("page", { timeout: 15_000 }),
    option.click(),
  ]);

  return newTab;
}

export async function navigateToSiradig(
  page: Page,
  onLog?: (msg: string) => void,
): Promise<Page | null> {
  const log = onLog ?? (() => {});

  try {
    const siradigPage = await searchAndOpenService(page, "SiRADIG", "SiRADIG - Trabajador", log);
    await siradigPage.waitForLoadState("domcontentloaded");
    log(`SiRADIG URL: ${siradigPage.url()}`);

    log("SiRADIG cargado correctamente (nueva pestaña)");
    return siradigPage;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error navegando a SiRADIG: ${msg} | URL: ${page.url()}`);
    return null;
  }
}
