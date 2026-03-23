import { Resend } from "resend";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/prisma";
import { processDocument } from "@/lib/ocr/pipeline";
import { classifyCategory } from "@/lib/ocr/category-classifier";
import { resolveCategory } from "@/lib/catalog/provider-catalog";
import { extractTokenFromEmail } from "@/lib/email/token";
import { Prisma, DeductionCategory, InvoiceType } from "@/generated/prisma/client";
import {
  DEDUCTION_CATEGORY_LABELS as CATEGORY_LABELS,
  INVOICE_TYPE_LABELS,
} from "@/lib/validators/invoice";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const RATE_LIMIT_PER_HOUR = 20;

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

interface CreatedInvoiceInfo {
  providerName: string | null;
  providerCuit: string;
  category: string;
  invoiceType: string;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  amount: number;
  fiscalYear: number;
  fiscalMonth: number;
  needsReview: boolean;
  filename: string | null;
}

interface IngestResult {
  invoicesCreated: number;
  errors: string[];
  createdInvoices: CreatedInvoiceInfo[];
}

interface NormalizedAttachment {
  filename: string | null;
  contentType: string;
  size: number;
  getBuffer: () => Promise<Buffer>;
}

// ─── Email reply helpers ──────────────────────────────────────────────────────

function formatCuit(cuit: string): string {
  if (cuit.length === 11) {
    return `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`;
  }
  return cuit;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMonth(month: number): string {
  return (
    [
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
    ][month - 1] ?? String(month)
  );
}

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f2f2f7;width:40%;">
        <span style="font-size:11px;font-weight:500;letter-spacing:0.6px;text-transform:uppercase;color:#8e8e93;">${label}</span>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f2f2f7;text-align:right;">
        <span style="font-size:14px;color:#1d1d1f;">${value}</span>
      </td>
    </tr>`;
}

function invoiceCard(inv: CreatedInvoiceInfo): string {
  const provider = inv.providerName
    ? `${inv.providerName}<br><span style="font-size:12px;color:#8e8e93;">${formatCuit(inv.providerCuit)}</span>`
    : formatCuit(inv.providerCuit);

  return `
    <div style="margin-bottom:16px;border:1px solid #e5e5ea;border-radius:10px;overflow:hidden;">
      ${inv.filename ? `<div style="padding:10px 16px;background:#f9f9fb;border-bottom:1px solid #f2f2f7;font-size:12px;color:#8e8e93;">${inv.filename}</div>` : ""}
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:4px 16px 0;">
        ${row("Proveedor", provider)}
        ${row("Categoría SiRADIG", CATEGORY_LABELS[inv.category] ?? inv.category)}
        ${row("Tipo", INVOICE_TYPE_LABELS[inv.invoiceType] ?? inv.invoiceType)}
        ${row("Número", inv.invoiceNumber ?? "—")}
        ${row("Fecha", formatDate(inv.invoiceDate))}
        ${row("Período", `${formatMonth(inv.fiscalMonth)} ${inv.fiscalYear}`)}
        <tr>
          <td style="padding:10px 0;width:40%;">
            <span style="font-size:11px;font-weight:500;letter-spacing:0.6px;text-transform:uppercase;color:#8e8e93;">Monto</span>
          </td>
          <td style="padding:10px 0;text-align:right;">
            <span style="font-size:15px;font-weight:600;color:#1d1d1f;">${formatAmount(inv.amount)}</span>
          </td>
        </tr>
      </table>
      ${inv.needsReview ? `<div style="padding:10px 16px;background:#fff9f0;border-top:1px solid #fdecc8;font-size:12px;color:#8a6000;">Algunos campos no se detectaron con precisión y requieren revisión manual.</div>` : ""}
    </div>`;
}

function buildSuccessHtml(originalSubject: string | null, invoices: CreatedInvoiceInfo[]): string {
  const count = invoices.length;
  const headline = count === 1 ? "Factura cargada" : `${count} facturas cargadas`;
  const subline =
    count === 1
      ? "Se procesó y guardó el comprobante adjunto en tu cuenta de desgrava.ar."
      : `Se procesaron y guardaron ${count} comprobantes adjuntos en tu cuenta de desgrava.ar.`;

  return buildLayout(`
    <div style="padding:32px 40px 8px;">
      <div style="display:inline-block;padding:4px 10px;background:#d1f5e0;border-radius:20px;margin-bottom:16px;">
        <span style="font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:#1a7a45;">Completado</span>
      </div>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1d1d1f;letter-spacing:-0.3px;">${headline}</h1>
      <p style="margin:0 0 4px;font-size:15px;color:#3a3a3c;line-height:1.6;">${subline}</p>
      ${originalSubject ? `<p style="margin:8px 0 0;font-size:13px;color:#8e8e93;">Asunto original: ${originalSubject}</p>` : ""}
    </div>
    <div style="padding:24px 40px 32px;">
      ${invoices.map(invoiceCard).join("")}
    </div>
  `);
}

function buildFailureHtml(originalSubject: string | null, errorMessage: string): string {
  const suggestions: Record<string, string> = {
    "No se encontraron adjuntos":
      "Asegurate de adjuntar el archivo PDF, JPG, PNG o WebP directamente al email (no como enlace).",
    "Ningún adjunto válido":
      "El adjunto debe ser un archivo PDF, JPG, PNG o WebP de menos de 10 MB.",
    "Límite de envíos alcanzado":
      "Podés enviar hasta 20 emails por hora. Intentá de nuevo más tarde.",
  };
  const suggestion = Object.entries(suggestions).find(([k]) => errorMessage.includes(k))?.[1];

  return buildLayout(`
    <div style="padding:32px 40px 8px;">
      <div style="display:inline-block;padding:4px 10px;background:#fde8e8;border-radius:20px;margin-bottom:16px;">
        <span style="font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:#9b1c1c;">Error</span>
      </div>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1d1d1f;letter-spacing:-0.3px;">No se pudo procesar el email</h1>
      ${originalSubject ? `<p style="margin:0 0 4px;font-size:13px;color:#8e8e93;">Asunto original: ${originalSubject}</p>` : ""}
    </div>
    <div style="padding:0 40px 32px;">
      <div style="border:1px solid #fde8e8;border-radius:10px;padding:16px 20px;background:#fff9f9;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;color:#9b1c1c;">Motivo</p>
        <p style="margin:0;font-size:14px;color:#3a3a3c;line-height:1.5;">${errorMessage}</p>
      </div>
      ${
        suggestion
          ? `
      <div style="margin-top:12px;border:1px solid #e5e5ea;border-radius:10px;padding:16px 20px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;color:#8e8e93;">Sugerencia</p>
        <p style="margin:0;font-size:14px;color:#3a3a3c;line-height:1.5;">${suggestion}</p>
      </div>`
          : ""
      }
    </div>
  `);
}

function buildPartialHtml(
  originalSubject: string | null,
  invoices: CreatedInvoiceInfo[],
  errors: string[],
): string {
  return buildLayout(`
    <div style="padding:32px 40px 8px;">
      <div style="display:inline-block;padding:4px 10px;background:#fff3d6;border-radius:20px;margin-bottom:16px;">
        <span style="font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:#7a5200;">Parcial</span>
      </div>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1d1d1f;letter-spacing:-0.3px;">Procesamiento parcial</h1>
      <p style="margin:0 0 4px;font-size:15px;color:#3a3a3c;line-height:1.6;">Se cargó ${invoices.length} de ${invoices.length + errors.length} comprobante${invoices.length + errors.length > 1 ? "s" : ""}.</p>
      ${originalSubject ? `<p style="margin:8px 0 0;font-size:13px;color:#8e8e93;">Asunto original: ${originalSubject}</p>` : ""}
    </div>
    <div style="padding:24px 40px 8px;">
      ${invoices.map(invoiceCard).join("")}
    </div>
    <div style="padding:0 40px 32px;">
      <div style="border:1px solid #fde8e8;border-radius:10px;padding:16px 20px;background:#fff9f9;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;color:#9b1c1c;">Errores</p>
        ${errors.map((e) => `<p style="margin:0 0 4px;font-size:13px;color:#3a3a3c;line-height:1.5;">• ${e}</p>`).join("")}
      </div>
    </div>
  `);
}

function buildLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>desgrava.ar</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;border:1px solid #e5e5ea;overflow:hidden;">
          <tr>
            <td style="padding:20px 40px;border-bottom:1px solid #f2f2f7;">
              <span style="font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#8e8e93;">desgrava.ar</span>
            </td>
          </tr>
          <tr>
            <td>${content}</td>
          </tr>
          <tr>
            <td style="padding:16px 40px;border-top:1px solid #f2f2f7;">
              <p style="margin:0;font-size:12px;color:#aeaeb2;line-height:1.5;">Este mensaje fue generado automáticamente. No respondas a este email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendReplyEmail(
  to: string,
  subject: string | null,
  status: "COMPLETED" | "PARTIAL" | "FAILED",
  invoices: CreatedInvoiceInfo[],
  errors: string[],
  errorMessage: string | null,
): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL ?? "desgrava.ar <notificaciones@desgrava.ar>";
  const replySubject =
    status === "COMPLETED"
      ? `✓ Factura cargada — desgrava.ar`
      : status === "PARTIAL"
        ? `⚠ Procesamiento parcial — desgrava.ar`
        : `✗ Error al procesar — desgrava.ar`;

  let html: string;
  if (status === "COMPLETED") {
    html = buildSuccessHtml(subject, invoices);
  } else if (status === "PARTIAL") {
    html = buildPartialHtml(subject, invoices, errors);
  } else {
    html = buildFailureHtml(subject, errorMessage ?? errors.join("; ") ?? "Error desconocido");
  }

  console.log(`[EMAIL_INGEST] sending reply from=${from} to=${to} subject="${replySubject}"`);
  try {
    const { data, error } = await getResend().emails.send({
      from,
      to,
      subject: replySubject,
      html,
    });
    if (error) {
      console.error(`[EMAIL_INGEST] reply send failed to=${to}:`, JSON.stringify(error));
    } else {
      console.log(`[EMAIL_INGEST] reply sent id=${data?.id} to=${to} status=${status}`);
    }
  } catch (err) {
    console.error(`[EMAIL_INGEST] reply send threw to=${to}:`, err);
  }
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function processInboundEmail(
  emailId: string,
  toAddresses: string[],
  fromAddress: string,
  subject: string | null,
): Promise<IngestResult> {
  const result: IngestResult = { invoicesCreated: 0, errors: [], createdInvoices: [] };

  console.log(
    `[EMAIL_INGEST] processInboundEmail start email_id=${emailId} from=${fromAddress} to=${JSON.stringify(toAddresses)}`,
  );

  // 1. Extract token from recipient address
  let token: string | null = null;
  for (const addr of toAddresses) {
    token = extractTokenFromEmail(addr);
    if (token) break;
  }
  console.log(`[EMAIL_INGEST] token extraction: token=${token ? token.slice(0, 8) + "…" : "null"}`);

  if (!token) {
    await prisma.emailIngestLog.create({
      data: {
        emailId,
        fromAddress,
        toAddress: toAddresses[0] || "",
        subject,
        status: "REJECTED",
        errorMessage: "El destinatario no pertenece a un dominio de ingesta válido",
      },
    });
    return result;
  }

  // 2. Look up user by ingest token
  const user = await prisma.user.findUnique({
    where: { ingestToken: token },
    select: { id: true },
  });

  console.log(`[EMAIL_INGEST] user lookup: found=${!!user}`);

  if (!user) {
    await prisma.emailIngestLog.create({
      data: {
        emailId,
        fromAddress,
        toAddress: toAddresses[0] || "",
        subject,
        status: "REJECTED",
        errorMessage: "Token de ingesta inválido",
      },
    });
    return result;
  }

  // 3. Rate-limit check
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.emailIngestLog.count({
    where: {
      userId: user.id,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (recentCount >= RATE_LIMIT_PER_HOUR) {
    await prisma.emailIngestLog.create({
      data: {
        userId: user.id,
        emailId,
        fromAddress,
        toAddress: toAddresses[0] || "",
        subject,
        status: "REJECTED",
        errorMessage: "Límite de envíos alcanzado",
      },
    });
    await sendReplyEmail(fromAddress, subject, "FAILED", [], [], "Límite de envíos alcanzado");
    return result;
  }

  // 4. Create log entry
  const log = await prisma.emailIngestLog.create({
    data: {
      userId: user.id,
      emailId,
      fromAddress,
      toAddress: toAddresses[0] || "",
      subject,
      status: "PROCESSING",
    },
  });

  try {
    // 5. Fetch attachments — try Resend API first, fall back to raw MIME for forwarded emails
    const resend = getResend();
    const { data: attachmentList } = await resend.emails.receiving.attachments.list({
      emailId,
    });

    const resendAttachments = attachmentList?.data ?? [];
    console.log(
      `[EMAIL_INGEST] attachments.list returned ${resendAttachments.length} items: ${JSON.stringify(resendAttachments.map((a) => ({ filename: a.filename, content_type: a.content_type, size: a.size })))}`,
    );
    let normalized: NormalizedAttachment[] = resendAttachments
      .filter((att) => ALLOWED_TYPES.includes(att.content_type) && att.size <= MAX_FILE_SIZE)
      .map((att) => ({
        filename: att.filename ?? null,
        contentType: att.content_type,
        size: att.size,
        getBuffer: async () => {
          const res = await fetch(att.download_url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return Buffer.from(await res.arrayBuffer());
        },
      }));

    // Fallback: parse raw MIME to find attachments nested inside forwarded messages
    if (normalized.length === 0) {
      console.log(`[EMAIL_INGEST] no valid attachments from API, trying raw MIME fallback`);
      const { data: emailData, error: emailError } = await resend.emails.receiving.get(emailId);
      console.log(
        `[EMAIL_INGEST] receiving.get: hasRaw=${!!emailData?.raw?.download_url} error=${JSON.stringify(emailError)}`,
      );
      const rawUrl = emailData?.raw?.download_url;
      if (rawUrl) {
        const mimeRes = await fetch(rawUrl);
        console.log(`[EMAIL_INGEST] raw MIME download: status=${mimeRes.status}`);
        if (mimeRes.ok) {
          const parsed = await simpleParser(Buffer.from(await mimeRes.arrayBuffer()));
          console.log(
            `[EMAIL_INGEST] mailparser found ${parsed.attachments?.length ?? 0} attachments: ${JSON.stringify(parsed.attachments?.map((a) => ({ filename: a.filename, contentType: a.contentType, size: a.size })))}`,
          );
          normalized = (parsed.attachments ?? [])
            .filter((att) => ALLOWED_TYPES.includes(att.contentType) && att.size <= MAX_FILE_SIZE)
            .map((att) => ({
              filename: att.filename ?? null,
              contentType: att.contentType,
              size: att.size,
              getBuffer: async () => att.content,
            }));
          console.log(
            `[EMAIL_INGEST] after type/size filter: ${normalized.length} processable attachments`,
          );
        }
      }
    }

    if (normalized.length === 0) {
      const errorMessage =
        resendAttachments.length === 0
          ? "No se encontraron adjuntos"
          : "Ningún adjunto válido (debe ser PDF, JPG, PNG o WebP, máximo 10 MB)";
      await prisma.emailIngestLog.update({
        where: { id: log.id },
        data: {
          status: "FAILED",
          attachmentCount: resendAttachments.length,
          errorMessage,
        },
      });
      await sendReplyEmail(fromAddress, subject, "FAILED", [], [], errorMessage);
      return result;
    }

    await prisma.emailIngestLog.update({
      where: { id: log.id },
      data: { attachmentCount: normalized.length },
    });

    // 6. Process each valid attachment
    for (const attachment of normalized) {
      try {
        const buffer = await attachment.getBuffer();

        // Run OCR pipeline
        const ocrResult = await processDocument(buffer, attachment.contentType);

        // Resolve category via global catalog (falls back to AI classification)
        const cuit = ocrResult.fields.cuit?.replace(/[-\s]/g, "") ?? "";
        const categoryStr =
          cuit.length >= 10
            ? await resolveCategory({
                cuit,
                providerName: ocrResult.fields.providerName ?? undefined,
                pdfText: ocrResult.text,
              })
            : await classifyCategory(ocrResult.text);
        const category = (
          Object.values(DeductionCategory).includes(categoryStr as DeductionCategory)
            ? categoryStr
            : "OTRAS_DEDUCCIONES"
        ) as DeductionCategory;

        // Determine fiscal period
        const now = new Date();
        let fiscalYear = now.getFullYear();
        let fiscalMonth = now.getMonth() + 1;

        if (ocrResult.fields.date) {
          const parsed = new Date(ocrResult.fields.date);
          if (!isNaN(parsed.getTime())) {
            fiscalYear = parsed.getFullYear();
            fiscalMonth = parsed.getMonth() + 1;
          }
        }

        // Build description noting manual review if needed
        const needsReview =
          !ocrResult.fields.cuit || !ocrResult.fields.invoiceType || !ocrResult.fields.amount;

        const descriptionParts: string[] = [];
        if (needsReview) {
          descriptionParts.push("[Requiere revisión manual - cargada por email]");
        }
        if (subject) {
          descriptionParts.push(`Asunto: ${subject}`);
        }
        const description = descriptionParts.length > 0 ? descriptionParts.join(" | ") : undefined;

        // Determine invoice type
        const invoiceTypeStr = ocrResult.fields.invoiceType;
        const invoiceType = (
          invoiceTypeStr && Object.values(InvoiceType).includes(invoiceTypeStr as InvoiceType)
            ? invoiceTypeStr
            : "FACTURA_B"
        ) as InvoiceType;

        // Create the invoice
        await prisma.invoice.create({
          data: {
            userId: user.id,
            deductionCategory: category,
            providerCuit: ocrResult.fields.cuit || "00000000000",
            providerName: ocrResult.fields.providerName || undefined,
            invoiceType,
            invoiceNumber: ocrResult.fields.invoiceNumber || undefined,
            invoiceDate: ocrResult.fields.date ? new Date(ocrResult.fields.date) : undefined,
            amount: new Prisma.Decimal(ocrResult.fields.amount || 0),
            fiscalYear,
            fiscalMonth,
            description,
            source: "EMAIL",
            ocrConfidence: ocrResult.fields.confidence,
            originalFilename: attachment.filename || `email-attachment-${emailId}`,
            fileData: Buffer.from(buffer),
            fileMimeType: attachment.contentType,
          },
        });

        result.invoicesCreated++;
        result.createdInvoices.push({
          providerName: ocrResult.fields.providerName ?? null,
          providerCuit: ocrResult.fields.cuit || "00000000000",
          category,
          invoiceType,
          invoiceNumber: ocrResult.fields.invoiceNumber ?? null,
          invoiceDate: ocrResult.fields.date ? new Date(ocrResult.fields.date) : null,
          amount: parseFloat(String(ocrResult.fields.amount ?? 0)),
          fiscalYear,
          fiscalMonth,
          needsReview,
          filename: attachment.filename,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido al procesar";
        result.errors.push(`Error al procesar ${attachment.filename}: ${msg}`);
      }
    }

    // 7. Update log with final status
    const finalStatus =
      result.invoicesCreated === 0
        ? "FAILED"
        : result.invoicesCreated < normalized.length
          ? "PARTIAL"
          : "COMPLETED";

    await prisma.emailIngestLog.update({
      where: { id: log.id },
      data: {
        status: finalStatus,
        invoicesCreated: result.invoicesCreated,
        errorMessage: result.errors.length > 0 ? result.errors.join("; ") : undefined,
      },
    });

    // 8. Send reply email
    await sendReplyEmail(
      fromAddress,
      subject,
      finalStatus,
      result.createdInvoices,
      result.errors,
      result.errors.length > 0 ? result.errors.join("; ") : null,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    await prisma.emailIngestLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        errorMessage: msg,
      },
    });
    result.errors.push(msg);
    await sendReplyEmail(fromAddress, subject, "FAILED", [], [], msg);
  }

  return result;
}
