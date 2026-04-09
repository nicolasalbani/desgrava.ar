import { prisma } from "@/lib/prisma";

export interface AttentionCounts {
  facturas: number;
  recibos: number;
  perfil: number;
}

/**
 * Count invoices and receipts that need user attention.
 *
 * Facturas need attention when:
 * - No SUBMIT_INVOICE job exists
 * - Latest SUBMIT_INVOICE job is FAILED
 * - Category is GASTOS_EDUCATIVOS and familyDependentId is null
 *
 * Recibos need attention when:
 * - No SUBMIT_DOMESTIC_DEDUCTION job exists
 * - Latest SUBMIT_DOMESTIC_DEDUCTION job is FAILED
 * - domesticWorkerId is null
 */
export async function getAttentionCounts(
  userId: string,
  fiscalYear?: number,
): Promise<AttentionCounts> {
  const yearFilter = fiscalYear ? `AND i."fiscalYear" = ${fiscalYear}` : "";
  const yearFilterR = fiscalYear ? `AND r."fiscalYear" = ${fiscalYear}` : "";

  const [facturasResult, recibosResult, personalDataResult, employerResult] = await Promise.all([
    prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `
      SELECT COUNT(*) as count
      FROM "Invoice" i
      WHERE i."userId" = $1
        ${yearFilter}
        AND i."deductionCategory" != 'NO_DEDUCIBLE'
        AND (
          -- No SUBMIT_INVOICE job exists
          NOT EXISTS (
            SELECT 1 FROM "AutomationJob" j
            WHERE j."invoiceId" = i."id" AND j."jobType" = 'SUBMIT_INVOICE'
          )
          -- Latest SUBMIT_INVOICE job is FAILED
          OR EXISTS (
            SELECT 1 FROM "AutomationJob" j
            WHERE j."invoiceId" = i."id" AND j."jobType" = 'SUBMIT_INVOICE'
              AND j."status" = 'FAILED'
              AND j."createdAt" = (
                SELECT MAX(j2."createdAt") FROM "AutomationJob" j2
                WHERE j2."invoiceId" = i."id" AND j2."jobType" = 'SUBMIT_INVOICE'
              )
          )
          -- Educational expense missing family member
          OR (i."deductionCategory" = 'GASTOS_EDUCATIVOS' AND i."familyDependentId" IS NULL)
        )
      `,
      userId,
    ),
    prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `
      SELECT COUNT(*) as count
      FROM "DomesticReceipt" r
      WHERE r."userId" = $1
        ${yearFilterR}
        AND (
          -- No SUBMIT_DOMESTIC_DEDUCTION job exists
          NOT EXISTS (
            SELECT 1 FROM "AutomationJob" j
            INNER JOIN "_AutomationJobToDomesticReceipt" rel
              ON rel."A" = j."id" AND rel."B" = r."id"
            WHERE j."jobType" = 'SUBMIT_DOMESTIC_DEDUCTION'
          )
          -- Latest SUBMIT_DOMESTIC_DEDUCTION job is FAILED
          OR EXISTS (
            SELECT 1 FROM "AutomationJob" j
            INNER JOIN "_AutomationJobToDomesticReceipt" rel
              ON rel."A" = j."id" AND rel."B" = r."id"
            WHERE j."jobType" = 'SUBMIT_DOMESTIC_DEDUCTION'
              AND j."status" = 'FAILED'
              AND j."createdAt" = (
                SELECT MAX(j2."createdAt") FROM "AutomationJob" j2
                INNER JOIN "_AutomationJobToDomesticReceipt" rel2
                  ON rel2."A" = j2."id" AND rel2."B" = r."id"
                WHERE j2."jobType" = 'SUBMIT_DOMESTIC_DEDUCTION'
              )
          )
          -- Missing worker assignment
          OR r."domesticWorkerId" IS NULL
        )
      `,
      userId,
    ),
    prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM "PersonalData" WHERE "userId" = $1 ${fiscalYear ? `AND "fiscalYear" = ${fiscalYear}` : ""}`,
      userId,
    ),
    prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM "Employer" WHERE "userId" = $1 ${fiscalYear ? `AND "fiscalYear" = ${fiscalYear}` : ""}`,
      userId,
    ),
  ]);

  let perfil = 0;
  if (Number(personalDataResult[0].count) === 0) perfil++;
  if (Number(employerResult[0].count) === 0) perfil++;

  return {
    facturas: Number(facturasResult[0].count),
    recibos: Number(recibosResult[0].count),
    perfil,
  };
}
