import { Page } from "playwright";
import { ARCA_SELECTORS } from "./selectors";

export interface LoginResult {
  success: boolean;
  error?: string;
  hasCaptcha?: boolean;
}

export type ScreenshotCallback = (
  buffer: Buffer,
  slug: string,
  label: string
) => Promise<void>;

export async function loginToArca(
  page: Page,
  cuit: string,
  clave: string,
  onLog?: (msg: string) => void,
  onScreenshot?: ScreenshotCallback
): Promise<LoginResult> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});
  const sel = ARCA_SELECTORS.login;

  try {
    log("Navegando a la pagina de login de ARCA...");
    await page.goto(sel.url, { waitUntil: "networkidle" });

    await capture(
      await page.screenshot({ fullPage: true }),
      "login-page",
      "Pagina de login ARCA"
    );

    // Check for CAPTCHA
    const captcha = await page.$(sel.captchaContainer);
    if (captcha) {
      await capture(
        await page.screenshot({ fullPage: true }),
        "captcha-detected",
        "CAPTCHA detectado"
      );
      log("CAPTCHA detectado. Se requiere intervencion manual.");
      return { success: false, error: "CAPTCHA detectado", hasCaptcha: true };
    }

    // Enter CUIT
    log("Ingresando CUIT...");
    await page.fill(sel.cuitInput, cuit);
    await page.click(sel.cuitSubmit);
    await page.waitForLoadState("networkidle");

    await capture(
      await page.screenshot({ fullPage: true }),
      "after-cuit",
      "CUIT ingresado"
    );

    // Enter password
    log("Ingresando clave fiscal...");
    await page.fill(sel.claveInput, clave);
    await page.click(sel.loginSubmit);
    await page.waitForLoadState("networkidle");

    // Check for errors
    const errorEl = await page.$(sel.errorMessage);
    if (errorEl) {
      const errorText = await errorEl.textContent();
      await capture(
        await page.screenshot({ fullPage: true }),
        "login-error",
        "Error de login"
      );
      log(`Error de login: ${errorText}`);
      return {
        success: false,
        error: errorText?.trim() || "Error de autenticacion",
      };
    }

    // Verify we're logged in (URL should change from login page)
    const currentUrl = page.url();
    if (currentUrl.includes("login")) {
      log("Login fallido: sigue en la pagina de login");
      return { success: false, error: "Login fallido" };
    }

    await capture(
      await page.screenshot({ fullPage: true }),
      "login-success",
      "Login exitoso"
    );

    log("Login exitoso en ARCA");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error durante login: ${msg}`);
    return { success: false, error: msg };
  }
}

export async function navigateToSiradig(
  page: Page,
  onLog?: (msg: string) => void,
  onScreenshot?: ScreenshotCallback
): Promise<boolean> {
  const log = onLog ?? (() => {});
  const capture = onScreenshot ?? (async () => {});

  try {
    log("Navegando al portal de servicios...");
    await page.goto(ARCA_SELECTORS.portal.servicesUrl, {
      waitUntil: "networkidle",
    });

    await capture(
      await page.screenshot({ fullPage: true }),
      "portal",
      "Portal de servicios ARCA"
    );

    // Try to find SiRADIG link directly or search for it
    let siradigLink = await page.$(ARCA_SELECTORS.portal.siradigLink);

    if (!siradigLink) {
      log("Buscando SiRADIG en el portal...");
      const searchInput = await page.$(ARCA_SELECTORS.portal.searchService);
      if (searchInput) {
        await page.fill(ARCA_SELECTORS.portal.searchService, "SiRADIG");
        await page.waitForTimeout(2000);
        siradigLink = await page.$(ARCA_SELECTORS.portal.siradigLink);
      }
    }

    if (!siradigLink) {
      log("No se encontro el acceso a SiRADIG");
      return false;
    }

    log("Accediendo a SiRADIG...");
    await siradigLink.click();
    await page.waitForLoadState("networkidle");

    await capture(
      await page.screenshot({ fullPage: true }),
      "siradig-loaded",
      "SiRADIG cargado"
    );

    log("SiRADIG cargado correctamente");
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    log(`Error navegando a SiRADIG: ${msg}`);
    return false;
  }
}
