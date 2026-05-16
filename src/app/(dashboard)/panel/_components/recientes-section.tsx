import { Decimal } from "decimal.js";
import { prisma } from "@/lib/prisma";
import { ComprobantesRecientes } from "@/components/dashboard/comprobantes-recientes";

interface RecientesSectionProps {
  userId: string;
  fiscalYear: number;
}

export async function RecientesSection({ userId, fiscalYear }: RecientesSectionProps) {
  const [totalCount, recent] = await Promise.all([
    prisma.invoice.count({
      where: { userId, fiscalYear, deductionCategory: { not: "NO_DEDUCIBLE" } },
    }),
    prisma.invoice.findMany({
      where: { userId, fiscalYear, deductionCategory: { not: "NO_DEDUCIBLE" } },
      orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
      take: 6,
      select: {
        id: true,
        providerName: true,
        providerCuit: true,
        deductionCategory: true,
        invoiceNumber: true,
        invoiceDate: true,
        amount: true,
        siradiqStatus: true,
      },
    }),
  ]);

  const serialized = recent.map((invoice) => ({
    id: invoice.id,
    providerName: invoice.providerName,
    providerCuit: invoice.providerCuit,
    deductionCategory: invoice.deductionCategory,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate?.toISOString() ?? null,
    amount: new Decimal(invoice.amount.toString()).toDP(2).toNumber(),
    siradiqStatus: invoice.siradiqStatus,
  }));

  return <ComprobantesRecientes invoices={serialized} totalCount={totalCount} />;
}
