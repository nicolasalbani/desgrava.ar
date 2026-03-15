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
    saveButton:
      "button[type='submit'][value*='Guardar'], input[type='submit'][value*='Guardar'], button:has-text('Guardar')",

    // Confirmation
    confirmButton: "button:has-text('Confirmar'), button:has-text('Aceptar')",
    successMessage: ".alert-success, .mensaje-exito",
    errorContainer: ".alert-danger, .mensaje-error",

    // Cargas de familia section
    cargasFamilia: {
      accordionTab: "#header_cargas_familia",
      sectionContainer: "#seccion_cargas_familia",
      tableContainer: "#div_tabla_cargas_familia",
      table: "#nueva_tabla_cargas_familia",
      tableRows: "#nueva_tabla_cargas_familia tbody tr",
      editButton: ".act_editar",
      // Edit form fields
      formTipoDoc: "#idTipoDoc",
      formNumeroDoc: "#numeroDoc",
      formApellido: "#apellido",
      formNombre: "#nombre",
      formFechaNacimiento: "#fechaNacimiento",
      formParentesco: "#idParentesco",
      formFechaCasamiento: "#fechaCasamiento",
      formPorcentajeDed: "#porcentajeDed",
      formCuitOtroDed: "#cuitOtroDed",
      formFamiliaCargo: "#familiaCargo",
      formResidente: "#residente",
      formIngresos: "#ingresos",
      formMontoIngresos: "#montoIngresos",
      formMesDesde: "#mesDesde",
      formMesHasta: "#mesHasta",
      formProximosPeriodos: "#proximosPeriodos",
      formVolverBtn: "#btn_volver, button:has-text('Volver')",
    },
  },
  // Mis Comprobantes service (fes.afip.gob.ar/mcmp/)
  // Verified with /arca-assisted-navigation on 2026-03-14
  misComprobantes: {
    // Portal: service link (inside the "Más utilizados" section)
    serviceLinkText: "Mis Comprobantes",
    portalServiceLink: "a.full-width:has-text('Mis Comprobantes')",

    // Landing page: choose Emitidos or Recibidos
    baseUrl: "https://fes.afip.gob.ar/mcmp/jsp/setearContribuyente.do?idContribuyente=0",
    comprobantesRecibidosBtn: "#btnRecibidos",

    // Search form (Comprobantes Recibidos)
    fechaEmisionInput: "#fechaEmision", // jQuery daterangepicker — set via JS API
    searchButton: "#buscarComprobantes",

    // Results (DataTables)
    resultsTable: "table.dataTable",
    resultsInfo: ".dataTables_info",
    exportCsvButton: "button[title='Exportar como CSV']",
    noResultsMessage: ".dataTables_empty",

    // History tab (for getting idConsulta after search)
    historialTab: "a[href='#tabHistorial']",
    historialRows: "#tablaHistorialConsultas tbody tr",

    // CSV download endpoint (server-side)
    csvDownloadPath: "descargarComprobantes.do",
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
  "siradig.cargasFamilia.accordionTab": "Seccion Cargas de Familia (accordion)",
  "siradig.cargasFamilia.table": "Tabla de cargas de familia",
  "siradig.cargasFamilia.editButton": "Boton editar carga de familia",
  "misComprobantes.comprobantesRecibidosBtn": "Boton Comprobantes Recibidos",
  "misComprobantes.searchButton": "Boton Buscar comprobantes",
  "misComprobantes.exportCsvButton": "Boton Exportar como CSV",
  "misComprobantes.fechaEmisionInput": "Campo de rango de fechas (daterangepicker)",
};
