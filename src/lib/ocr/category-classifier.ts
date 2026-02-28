import OpenAI from "openai";
import { DEDUCTION_CATEGORIES } from "@/lib/validators/invoice";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

/**
 * Descripciones oficiales de cada categoría de deducción según normativa ARCA (ex-AFIP)
 * para el formulario SiRADIG F.572 Web — Ley de Impuesto a las Ganancias, artículos 85 y 86.
 * Fuente: ARCA (arca.gob.ar), RG 4003/17, y manual SiRADIG.
 */
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  CUOTAS_MEDICO_ASISTENCIALES:
    "Cuotas médico-asistenciales: importes abonados en concepto de cuota de medicina prepaga o el excedente del aporte obligatorio a la obra social. Incluye aportes complementarios a obras sociales y cuotas de planes de salud. Límite: hasta el 5% de la ganancia neta del ejercicio.",

  PRIMAS_SEGURO_MUERTE:
    "Primas de seguro para caso de muerte: importes abonados en concepto de seguros de vida que cubran riesgo de muerte del contribuyente. Incluye seguros de vida obligatorios para empleados en relación de dependencia y seguros de vida voluntarios.",

  PRIMAS_AHORRO_SEGUROS_MIXTOS:
    "Primas de ahorro correspondientes a seguros mixtos: la parte de la prima destinada al componente de ahorro en seguros que combinan cobertura de vida con capitalización. Solo corresponde la porción de ahorro, no la de riesgo.",

  APORTES_RETIRO_PRIVADO:
    "Aportes a planes de seguro de retiro privados: importes abonados a planes de jubilación privada o retiro administrados por compañías de seguros. No incluye aportes obligatorios al régimen público previsional.",

  DONACIONES:
    "Donaciones a entidades exentas: importes donados al fisco nacional, provincial o municipal; instituciones religiosas; asociaciones, fundaciones y entidades civiles sin fines de lucro reconocidas como exentas por ARCA. Límite: hasta el 5% de la ganancia neta del ejercicio.",

  INTERESES_HIPOTECARIOS:
    "Intereses por préstamo hipotecario: intereses efectivamente pagados por créditos hipotecarios otorgados para la compra o construcción de inmueble destinado a casa-habitación del contribuyente. Límite: hasta $20.000 anuales (art. 85 inc. a).",

  GASTOS_SEPELIO:
    "Gastos de sepelio: gastos efectivamente incurridos en concepto de sepelio del contribuyente o de personas a su cargo. Corresponde a los gastos debidamente documentados con comprobantes.",

  GASTOS_MEDICOS:
    "Gastos médicos y paramédicos: honorarios facturados por servicios de asistencia sanitaria, médica y paramédica, tanto para el contribuyente como para sus cargas de familia. Se puede deducir el 40% del total facturado, con un límite del 5% de la ganancia neta del ejercicio.",

  GASTOS_INDUMENTARIA_TRABAJO:
    "Gastos de adquisición de indumentaria y equipamiento para uso exclusivo en el lugar de trabajo: importes abonados por ropa, herramientas y equipamiento de uso estrictamente laboral, siempre que no hayan sido reintegrados por el empleador. Incluye también servicios de conectividad a internet (como Starlink, Fibertel, Telecentro, Personal, Movistar), telefonía laboral, y equipamiento tecnológico (computadoras, tablets, impresoras) utilizados exclusivamente para el trabajo o trabajo remoto.",

  ALQUILER_VIVIENDA:
    "Alquiler de inmueble destinado a casa-habitación: se puede deducir el 40% de las sumas pagadas en concepto de alquiler de vivienda, hasta el límite de la ganancia no imponible anual. Requisitos: el contribuyente no debe ser titular de ningún inmueble, y el contrato debe estar registrado en el régimen RELI de ARCA.",

  SERVICIO_DOMESTICO:
    "Deducción del personal de casas particulares (servicio doméstico): remuneraciones y contribuciones patronales abonadas al personal de casas particulares según la Ley 26.844. Límite: hasta el monto de la ganancia no imponible anual.",

  APORTE_SGR:
    "Aportes a sociedades de garantía recíproca (SGR): importes aportados por socios protectores a SGR. Los aportes deben mantenerse en la sociedad por un plazo mínimo de 2 años. En caso de retiro antes de ese plazo, el monto deducido se reintegra como ganancia gravada del período de retiro.",

  VEHICULOS_CORREDORES:
    "Vehículos de corredores y viajantes de comercio: amortización impositiva de rodados afectados a la actividad de corredores y viajantes de comercio en relación de dependencia. Corresponde a la deducción por desgaste del vehículo utilizado exclusivamente para la actividad.",

  INTERESES_CORREDORES:
    "Intereses de corredores y viajantes de comercio: intereses por deudas relativas a la adquisición de rodados destinados a la actividad de corredores y viajantes de comercio. Se deducen los intereses efectivamente pagados durante el ejercicio fiscal.",

  GASTOS_EDUCATIVOS:
    "Gastos de educación: importes abonados por servicios educativos con reconocimiento oficial para hijos, hijastros o personas a cargo menores de 24 años. Incluye herramientas con fines educativos, útiles escolares, guardapolvos y uniformes. Límite: hasta el 40% de la ganancia no imponible anual.",

  OTRAS_DEDUCCIONES:
    "Otras deducciones: conceptos deducibles no comprendidos en las categorías anteriores. Incluye, entre otros: aportes jubilatorios voluntarios para la ANSES, aportes a cajas de jubilación provinciales, impuesto sobre débitos y créditos bancarios (impuesto al cheque), y otros conceptos admitidos por la normativa vigente.",
};

const SYSTEM_PROMPT = `Sos un asistente experto en impuestos argentinos, específicamente en el Impuesto a las Ganancias y el sistema SiRADIG (formulario F.572 Web) de ARCA (ex-AFIP).

Tu tarea es clasificar el texto de una factura o comprobante en la categoría de deducción correcta del SiRADIG.

Las categorías disponibles son:

${DEDUCTION_CATEGORIES.map((cat) => `- ${cat}: ${CATEGORY_DESCRIPTIONS[cat]}`).join("\n\n")}

INSTRUCCIONES:
- Analizá el texto del comprobante y determiná a qué categoría de deducción corresponde.
- Basate en el tipo de servicio o bien que describe la factura, el rubro del proveedor, y cualquier otro dato relevante.
- Respondé ÚNICAMENTE con el identificador exacto de la categoría (por ejemplo: CUOTAS_MEDICO_ASISTENCIALES).
- Si no podés determinar la categoría con certeza, respondé OTRAS_DEDUCCIONES.
- No incluyas explicaciones, solo el identificador.`;

export async function classifyCategory(invoiceText: string): Promise<string> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 50,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Texto del comprobante:\n\n${invoiceText.substring(0, 3000)}`,
        },
      ],
    });

    const result = response.choices[0]?.message?.content?.trim() ?? "";

    if ((DEDUCTION_CATEGORIES as readonly string[]).includes(result)) {
      return result;
    }

    return "OTRAS_DEDUCCIONES";
  } catch (error) {
    console.error("Error classifying category with OpenAI:", error);
    return "OTRAS_DEDUCCIONES";
  }
}
