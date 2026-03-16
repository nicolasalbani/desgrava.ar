export interface ExtractedReceiptFields {
  workerName: string | null;
  workerCuil: string | null;
  employerName: string | null;
  employerCuit: string | null;
  periodo: string | null; // "Febrero 2026"
  fiscalYear: number | null;
  fiscalMonth: number | null;
  categoriaProfesional: string | null;
  modalidadPrestacion: string | null;
  horasSemanales: string | null;
  modalidadLiquidacion: string | null;
  totalHorasTrabajadas: string | null;
  basico: number | null;
  antiguedad: number | null;
  viaticos: number | null;
  presentismo: number | null;
  otros: number | null;
  total: number | null;
  confidence: number;
}

const CUIL_PATTERN = /\b(20|23|24|27|30|33|34)-?\d{8}-?\d\b/g;

const MONTH_MAP: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function parseArgentineAmount(raw: string): number | null {
  // Argentine format: 343.116,00 → 343116.00
  const cleaned = raw.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function extractAmountAfterLabel(text: string, label: string): number | null {
  const pattern = new RegExp(label + "\\s*\\$?\\s*([\\d.,]+)", "i");
  const match = text.match(pattern);
  if (match) return parseArgentineAmount(match[1]);
  return null;
}

export function extractReceiptFields(text: string): ExtractedReceiptFields {
  let fieldsFound = 0;
  const totalFields = 5; // workerCuil, periodo, total, categoriaProfesional, workerName

  // Extract CUILs — first one is employer, second one is worker
  const cuilMatches = [...text.matchAll(CUIL_PATTERN)];
  let employerCuit: string | null = null;
  let workerCuil: string | null = null;

  if (cuilMatches.length >= 2) {
    employerCuit = cuilMatches[0][0].replace(/-/g, "");
    workerCuil = cuilMatches[1][0].replace(/-/g, "");
    fieldsFound++;
  } else if (cuilMatches.length === 1) {
    // Single CUIL found — determine if it's employer or worker based on context
    const cuil = cuilMatches[0][0].replace(/-/g, "");
    const cuilIndex = text.indexOf(cuilMatches[0][0]);
    const beforeCuil = text.slice(0, cuilIndex).toLowerCase();
    if (beforeCuil.includes("trabajador")) {
      workerCuil = cuil;
    } else {
      employerCuit = cuil;
    }
  }

  // Extract worker name from "Datos del Trabajador" section
  let workerName: string | null = null;
  const workerNameMatch = text.match(
    /Datos\s+del\s+Trabajador[\s\S]*?Apellido\s+y\s+Nombre\s*:?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]+)/i,
  );
  if (workerNameMatch) {
    workerName = workerNameMatch[1]
      .replace(/\s+/g, " ")
      .replace(/\s*(CUIT|CUIL|Obra\s+Social|Fecha).*$/i, "")
      .trim();
    if (workerName.length > 2) fieldsFound++;
  }

  // Fallback: if workerCuil present, look for name near it
  if (!workerName && workerCuil) {
    const formatted =
      workerCuil.slice(0, 2) + "-" + workerCuil.slice(2, 10) + "-" + workerCuil.slice(10);
    const idx = text.indexOf(formatted);
    if (idx > 0) {
      const before = text.slice(Math.max(0, idx - 200), idx);
      const nameMatch = before.match(/Apellido\s+y\s+Nombre\s*:?\s*([A-ZÁÉÍÓÚÑ][\w\sÁÉÍÓÚÑ]+)/i);
      if (nameMatch) {
        workerName = nameMatch[1].trim();
        if (workerName.length > 2) fieldsFound++;
      }
    }
  }

  // Extract employer name
  let employerName: string | null = null;
  const employerNameMatch = text.match(
    /Datos\s+del\s+Empleador[\s\S]*?Apellido\s+y\s+Nombre\s*:?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]+)/i,
  );
  if (employerNameMatch) {
    employerName = employerNameMatch[1]
      .replace(/\s+/g, " ")
      .replace(/\s*(CUIL|CUIT|Domicilio).*$/i, "")
      .trim();
  }

  // Extract period: "LIQUIDACIÓN CORRESPONDIENTE AL PERÍODO: Febrero 2026"
  let periodo: string | null = null;
  let fiscalYear: number | null = null;
  let fiscalMonth: number | null = null;

  const periodoMatch = text.match(
    /(?:LIQUIDACI[ÓO]N\s+CORRESPONDIENTE\s+AL\s+PER[IÍ]ODO|PER[IÍ]ODO)\s*:?\s*([A-Za-záéíóúÁÉÍÓÚ]+)\s+(\d{4})/i,
  );
  if (periodoMatch) {
    const monthStr = periodoMatch[1].toLowerCase();
    const year = parseInt(periodoMatch[2], 10);
    const month = MONTH_MAP[monthStr];
    if (month && year >= 2020 && year <= 2030) {
      // Capitalize first letter for display
      periodo = periodoMatch[1].charAt(0).toUpperCase() + periodoMatch[1].slice(1) + " " + year;
      fiscalYear = year;
      fiscalMonth = month;
      fieldsFound++;
    }
  }

  // Extract "Categoría Profesional"
  let categoriaProfesional: string | null = null;
  const catMatch = text.match(
    /Categor[ií]a\s+Profesional\s*:?\s*([A-Za-záéíóúÁÉÍÓÚÑñ\s]+?)(?:\s+Condici[oó]n|$)/im,
  );
  if (catMatch) {
    categoriaProfesional = catMatch[1].replace(/\s+/g, " ").trim();
    if (categoriaProfesional.length > 2) fieldsFound++;
  }

  // Extract "Modalidad de Prestación"
  let modalidadPrestacion: string | null = null;
  const modPrestMatch = text.match(
    /Modalidad\s+de\s+Prestaci[oó]n\s*:?\s*([A-Za-záéíóúÁÉÍÓÚÑñ\s]+?)(?:\s+Horas|$)/im,
  );
  if (modPrestMatch) {
    modalidadPrestacion = modPrestMatch[1].replace(/\s+/g, " ").trim();
  }

  // Extract "Horas semanales"
  let horasSemanales: string | null = null;
  const horasMatch = text.match(
    /Horas\s+semanales\s*:?\s*([A-Za-záéíóúÁÉÍÓÚÑñ\s\d]+?)(?:\s+Modalidad\s+de\s+Liquidaci|$)/im,
  );
  if (horasMatch) {
    horasSemanales = horasMatch[1].replace(/\s+/g, " ").trim();
  }

  // Extract "Modalidad de Liquidación"
  let modalidadLiquidacion: string | null = null;
  const modLiqMatch = text.match(
    /Modalidad\s+de\s+Liquidaci[oó]n\s*:?\s*([A-Za-záéíóúÁÉÍÓÚÑñ]+)/im,
  );
  if (modLiqMatch) {
    modalidadLiquidacion = modLiqMatch[1].trim();
  }

  // Extract "Total Horas trabajadas"
  let totalHorasTrabajadas: string | null = null;
  const totalHorasMatch = text.match(/Total\s+Horas\s+trabajadas\s*:?\s*([\d]+\s*hs?)/i);
  if (totalHorasMatch) {
    totalHorasTrabajadas = totalHorasMatch[1].trim();
  }

  // Extract salary breakdown
  const basico = extractAmountAfterLabel(text, "B[aá]sico");
  const antiguedad = extractAmountAfterLabel(text, "Antig[uü]edad");
  const viaticos = extractAmountAfterLabel(text, "Vi[aá]ticos");
  const presentismo = extractAmountAfterLabel(text, "Presentismo");
  const otros = extractAmountAfterLabel(text, "Otros");

  // Extract total — look for the "Total" line in the salary section
  let total: number | null = null;
  const totalMatch = text.match(/\bTotal\s+\$\s*([\d.,]+)/i);
  if (totalMatch) {
    total = parseArgentineAmount(totalMatch[1]);
    if (total !== null) fieldsFound++;
  }

  // Fallback: sum the components
  if (total === null) {
    const components = [basico, antiguedad, viaticos, presentismo, otros].filter(
      (v): v is number => v !== null,
    );
    if (components.length > 0) {
      total = components.reduce((sum, v) => sum + v, 0);
      fieldsFound++;
    }
  }

  const confidence = fieldsFound / totalFields;

  return {
    workerName,
    workerCuil,
    employerName,
    employerCuit,
    periodo,
    fiscalYear,
    fiscalMonth,
    categoriaProfesional,
    modalidadPrestacion,
    horasSemanales,
    modalidadLiquidacion,
    totalHorasTrabajadas,
    basico,
    antiguedad,
    viaticos,
    presentismo,
    otros,
    total,
    confidence,
  };
}
