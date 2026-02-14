// Centralized selectors for ARCA and SiRADIG websites
// These selectors are based on the known structure of the ARCA login page
// and SiRADIG web application. They may need updates if the sites change.
// Last verified: 2025

export const ARCA_SELECTORS = {
  // Login page
  login: {
    url: "https://auth.afip.gob.ar/contribuyente_/login.xhtml",
    cuitInput: "#F1\\:username",
    cuitSubmit: "#F1\\:btnSiguiente",
    claveInput: "#F1\\:password",
    loginSubmit: "#F1\\:btnIngresar",
    errorMessage: ".alert-danger, .error-message",
    captchaContainer: "#captcha, .g-recaptcha, [data-sitekey]",
  },

  // Post-login portal
  portal: {
    servicesUrl: "https://portalcf.cloud.afip.gob.ar/portal/app/",
    siradigLink: "a:has-text('SiRADIG - Trabajador'), a[href*='siradig'], a[title*='SiRADIG']",
    searchService: "#buscadorInput",
  },

  // SiRADIG application
  siradig: {
    baseUrl: "https://siradig.afip.gob.ar",

    // Deduction form fields (filled after category is selected)
    cuitProviderInput: "input[name*='cuit']",
    invoiceTypeSelect: "select[name*='comprobante'], select[name*='tipoComprobante']",
    amountInput: "input[name*='monto'], input[name*='importe']",
    periodFromSelect: "select[name*='periodoDesde'], select[name*='mesDesde'], select[name*='mes']",
    periodToSelect: "select[name*='periodoHasta'], select[name*='mesHasta']",
    saveButton: "button[type='submit'][value*='Guardar'], input[type='submit'][value*='Guardar'], button:has-text('Guardar')",

    // Confirmation
    confirmButton: "button:has-text('Confirmar'), button:has-text('Aceptar')",
    successMessage: ".alert-success, .mensaje-exito",
    errorContainer: ".alert-danger, .mensaje-error",
  },
} as const;

// Human-readable descriptions for logging
export const SELECTOR_DESCRIPTIONS: Record<string, string> = {
  "login.cuitInput": "Campo de CUIT",
  "login.cuitSubmit": "Boton Siguiente",
  "login.claveInput": "Campo de clave fiscal",
  "login.loginSubmit": "Boton Ingresar",
  "siradig.categoryDropdown": "Selector de categoria de deduccion",
  "siradig.cuitProviderInput": "Campo CUIT del proveedor",
  "siradig.amountInput": "Campo de monto",
  "siradig.saveButton": "Boton Guardar",
};
