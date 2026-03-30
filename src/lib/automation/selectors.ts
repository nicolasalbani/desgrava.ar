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
    searchResultsList: "#resBusqueda",
    searchResultOption: '[role="option"]',
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

    // Datos Personales section
    datosPersonales: {
      menuButton: "#btn_datos_personales",
      guardarBtn: "#btn_guardar",
      volverBtn: "#btn_volver",
      // Form fields (all readonly — used for extraction only)
      formApellido: "#apellido",
      formNombre: "#nombre",
      formDirCalle: "#dirCalle",
      formDirNro: "#dirNro",
      formDirPiso: "#dirPiso",
      formDirDpto: "#dirDpto",
      formDescProvincia: "#descProvincia",
      formLocalidad: "#localidad",
      formCodPostal: "#codPostal",
    },

    // Empleadores section (verified 2026-03-29)
    empleadores: {
      menuButton: "#btn_empleadores",
      tabLink: "#tab_principal_empleadores",
      tableRows: "tr[data-id-reg]",
      editButton: ".act_editar",
      nuevoEmpleadorBtn: "button:has-text('Nuevo Empleador')",
      // Form fields
      formEmpleadorSelect: "#idEmpleadores",
      formCuit: "#cuit",
      formRazonSocial: "#razonSocial",
      formFechaInicio: "#fechaInicioRelacion",
      formFechaFin: "#fechaFinRelacion",
      formAgenteRetencion: "#agenteRetencion",
      formVolverBtn: "#btn_volver, button:has-text('Volver')",
      formGuardarBtn: "#btn_guardar, button:has-text('Guardar')",
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

  // Personal de Casas Particulares (verified 2026-03-15)
  domestico: {
    baseUrl: "https://serviciossegsoc.afip.gob.ar/RegimenesEspeciales/app/DomesticoP/index.aspx",
    // Worker cards on home page
    workerCard: ".card, .trabajador-card",
    workerName: "h5, .card-title",
    workerCuil: "CUIL:",
    // Navigation buttons per worker
    datosDelTrabajadorBtn: "a:has-text('DATOS DEL TRABAJADOR')",
    pagosYRecibosBtn: "a:has-text('PAGOS Y RECIBOS')",
    // Worker detail page
    modificarDatosBtn: "a:has-text('MODIFICAR DATOS')",
    // Pagos y Recibos table
    pagosTable: "table",
    verReciboBtn: "a:has-text('VER RECIBO')",
    detallePagoBtn: "a:has-text('Detalle de pago'), a:has-text('DETALLE DE PAGO')",
    constanciaPagoBtn: "button:has-text('Constancia de pago')",
    // Pagination
    paginationNext: "a:has-text('Next'), a:has-text('»')",
    paginationLast: "a:has-text('Ultimo')",
    // Sidebar
    inicioLink: "a:has-text('Inicio')",
    historicosLink: "a:has-text('VER TRABAJADORES HISTÓRICOS')",
  },

  // SiRADIG deduction edit flow (verified 2026-03-15)
  siradigEdit: {
    // Deduction list tables — each category has its own table
    // NOTE: table IDs are dynamic per SiRADIG version; when a specific ID isn't
    // known, use fieldset legend text matching via reverseLookupCategory() instead.
    gastosMedicosTable: "#nueva_tabla_deducciones7",
    gastosIndumentariaTable: "#nueva_tabla_deducciones21",
    gastosEducativosTable: "#nueva_tabla_deducciones32",

    // Container for all deduction fieldsets
    deductionsContainer: "#div_tabla_deducciones_agrupadas",
    fieldsetSelector: "fieldset.grupo_deducciones",

    // Common selectors for deduction list rows
    listRow: "tbody tr[data-id-reg]",
    editButton: "div.act_editar",
    deleteRowButton: "div.eliminar",

    // Edit form fields (Gastos Médicos y Paramédicos)
    editCuit: "#numeroDoc", // read-only in edit mode
    editDenominacion: "#razonSocial", // read-only in edit mode
    editPeriodo: "#mesDesde", // select dropdown (standard) or hidden input (detalle mensual)
    editMontoTotal: "#montoTotal", // read-only, computed from comprobantes

    // Comprobantes sub-table inside edit form
    comprobantesTable: "#tabla_comprobantes",
    altaComprobanteBtn: "#btn_alta_comprobante",
    deleteComprobanteBtn: "div.eliminar span.ui-icon-close",

    // Comprobante dialog fields (inside "Alta de Comprobante" popup)
    cmpFechaEmision: "#cmpFechaEmision",
    cmpTipo: "#cmpTipo",
    cmpPuntoVenta: "#cmpPuntoVenta",
    cmpNumero: "#cmpNumero",
    cmpMontoFacturado: "#cmpMontoFacturado",
    cmpMontoReintegrado: "#cmpMontoReintegrado",

    // Edit form buttons
    editVolverBtn: "#btn_volver",
    editGuardarBtn: "#btn_guardar",
  },

  // SiRADIG "Deducción del Personal Doméstico" form (verified 2026-03-15)
  siradigDomestico: {
    // Accordion section
    deduccionesAccordion: "#header_deducciones, :has-text('Deducciones y desgravaciones')",
    agregarDeduccionBtn: "button:has-text('Agregar Deducciones y Desgravaciones')",
    deduccionDomesticoLink: "a:has-text('Deducción del personal doméstico')",
    // Form fields
    formCuit: "#numeroDoc",
    formApellidoNombre: "#razonSocial",
    formMesDesde: "#mesDesde",
    formMesHasta: "#mesHasta",
    formMontoTotal: "#montoTotal",
    // Detalle mensual dialog ("Alta de Detalle de Pagos")
    agregarDetalleBtn: "a:has-text('Agregar Detalle de Pagos'), #btn_alta_detalle",
    detalleMes: "#pagoMes",
    detalleContribucionMonto: "#pagoMontoContribucion",
    detalleContribucionFecha: "#pagoFechaContribucion",
    detalleRetribucionMonto: "#pagoMontoRetribucion",
    detalleRetribucionFecha: "#pagoFechaRetribucion",
    detalleAgregarBtn: ".ui-dialog-buttonset button:has-text('Agregar')",
    detalleCancelarBtn: ".ui-dialog-buttonset button:has-text('Cancelar')",
    // Form buttons
    formVolverBtn: "#btn_volver, button:has-text('Volver')",
    formGuardarBtn: "#btn_guardar, button:has-text('Guardar')",
    // Existing deduction table — NOTE: table ID is dynamic (e.g., #nueva_tabla_deducciones8).
    // Find by fieldset legend text "Deducción del Personal Doméstico" instead.
    domesticoFieldsetLegend: "personal doméstico",
    existingEditButton: "div.act_editar",
  },
  // SiRADIG Presentaciones — verified 2026-03-21 via /arca-assisted-navigation
  siradigPresentaciones: {
    // Main menu button to navigate to Consulta de Formularios Enviados
    consultaBtn: "#btn_consulta",
    // Tab link (visible in the top navigation bar after entering the section)
    consultaTab: "#tab_principal_consultas",
    // Table of sent forms (id="tabla_formularios")
    formulariosTable: "#tabla_formularios",
    formulariosTableRows: "#tabla_formularios tbody tr[data-id-reg]",
    // Print dropdown button inside each row (div with class "boton con_menu")
    printDropdownBtn: "div.boton.con_menu",
    // Print menu items (appear after clicking the dropdown)
    printSeccionA: "#menu_btn_imprimir_a", // "Sección A (para el Agente de Retención)"
    printSeccionB: "#menu_btn_imprimir_b", // "Sección B (para otros empleadores)"
    // PDF download URL pattern: /radig/jsp/descargarPDF.do?id=<session>&s=a
    // Carga de Formulario button
    cargaFormularioBtn: "#btn_carga",
    // Vista Previa page (URL: /radig/jsp/vistaPreviaFormulario.do)
    vistaPrevia: "#btn_vista_previa",
    // Imprimir Borrador (downloads PDF via jQuery click handler)
    imprimirBorrador: "#btn_imprimir_borrador",
    // Enviar al Empleador (opens confirmation dialog)
    enviarEmpleador: "#btn_enviar_empleador",
    // Confirmation dialog buttons (jQuery UI dialog)
    generarPresentacion: ".ui-dialog-buttonset button:has-text('Generar Presentación')",
    cancelarEnvio: ".ui-dialog-buttonset button:has-text('Cancelar')",
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
