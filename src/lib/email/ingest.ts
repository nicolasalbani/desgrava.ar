import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { processDocument } from "@/lib/ocr/pipeline";
import { classifyCategory } from "@/lib/ocr/category-classifier";
import { extractTokenFromEmail } from "@/lib/email/token";
import { Prisma, DeductionCategory, InvoiceType } from "@/generated/prisma/client";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const RATE_LIMIT_PER_HOUR = 20;

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

interface IngestResult {
  invoicesCreated: number;
  errors: string[];
}

export async function processInboundEmail(
  emailId: string,
  toAddresses: string[],
  fromAddress: string,
  subject: string | null
): Promise<IngestResult> {
  const result: IngestResult = { invoicesCreated: 0, errors: [] };

  // 1. Extract token from recipient address
  let token: string | null = null;
  for (const addr of toAddresses) {
    token = extractTokenFromEmail(addr);
    if (token) break;
  }

  if (!token) {
    await prisma.emailIngestLog.create({
      data: {
        emailId,
        fromAddress,
        toAddress: toAddresses[0] || "",
        subject,
        status: "REJECTED",
        errorMessage: "No matching ingest domain in recipient addresses",
      },
    });
    return result;
  }

  // 2. Look up user by ingest token
  const user = await prisma.user.findUnique({
    where: { ingestToken: token },
    select: { id: true },
  });

  if (!user) {
    await prisma.emailIngestLog.create({
      data: {
        emailId,
        fromAddress,
        toAddress: toAddresses[0] || "",
        subject,
        status: "REJECTED",
        errorMessage: "Invalid ingest token",
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
        errorMessage: "Rate limit exceeded",
      },
    });
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
    // 5. Fetch attachments from Resend API
    const resend = getResend();
    const { data: attachmentList } = await resend.emails.receiving.attachments.list({
      emailId,
    });

    const attachments = attachmentList?.data ?? [];
    const validAttachments = attachments.filter(
      (att) =>
        ALLOWED_TYPES.includes(att.content_type) && att.size <= MAX_FILE_SIZE
    );

    if (validAttachments.length === 0) {
      await prisma.emailIngestLog.update({
        where: { id: log.id },
        data: {
          status: "FAILED",
          attachmentCount: attachments.length,
          errorMessage: attachments.length === 0
            ? "No attachments found"
            : "No valid attachments (must be PDF/JPEG/PNG/WebP, max 10MB)",
        },
      });
      return result;
    }

    await prisma.emailIngestLog.update({
      where: { id: log.id },
      data: { attachmentCount: validAttachments.length },
    });

    // 6. Process each valid attachment
    for (const attachment of validAttachments) {
      try {
        // Download the attachment
        const response = await fetch(attachment.download_url);
        if (!response.ok) {
          result.errors.push(
            `Failed to download ${attachment.filename}: HTTP ${response.status}`
          );
          continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Run OCR pipeline
        const ocrResult = await processDocument(buffer, attachment.content_type);

        // Run AI category classification
        const categoryStr = await classifyCategory(ocrResult.text);
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
          !ocrResult.fields.cuit ||
          !ocrResult.fields.invoiceType ||
          !ocrResult.fields.amount;

        const descriptionParts: string[] = [];
        if (needsReview) {
          descriptionParts.push("[Requiere revisión manual - cargada por email]");
        }
        if (subject) {
          descriptionParts.push(`Asunto: ${subject}`);
        }
        const description = descriptionParts.length > 0
          ? descriptionParts.join(" | ")
          : undefined;

        // Determine invoice type
        const invoiceTypeStr = ocrResult.fields.invoiceType;
        const invoiceType = (
          invoiceTypeStr &&
          Object.values(InvoiceType).includes(invoiceTypeStr as InvoiceType)
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
            invoiceDate: ocrResult.fields.date
              ? new Date(ocrResult.fields.date)
              : undefined,
            amount: new Prisma.Decimal(ocrResult.fields.amount || 0),
            fiscalYear,
            fiscalMonth,
            description,
            source: "EMAIL",
            ocrConfidence: ocrResult.fields.confidence,
            originalFilename: attachment.filename || `email-attachment-${emailId}`,
            fileData: buffer,
            fileMimeType: attachment.content_type,
          },
        });

        result.invoicesCreated++;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Unknown processing error";
        result.errors.push(
          `Error processing ${attachment.filename}: ${msg}`
        );
      }
    }

    // 7. Update log with final status
    const finalStatus =
      result.invoicesCreated === 0
        ? "FAILED"
        : result.invoicesCreated < validAttachments.length
          ? "PARTIAL"
          : "COMPLETED";

    await prisma.emailIngestLog.update({
      where: { id: log.id },
      data: {
        status: finalStatus,
        invoicesCreated: result.invoicesCreated,
        errorMessage:
          result.errors.length > 0 ? result.errors.join("; ") : undefined,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await prisma.emailIngestLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        errorMessage: msg,
      },
    });
    result.errors.push(msg);
  }

  return result;
}
