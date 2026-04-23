-- AlterTable
ALTER TABLE "ProviderCatalog" ADD COLUMN     "lastReviewedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CatalogReviewProposal" (
    "id" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "proposedCategory" "DeductionCategory" NOT NULL,
    "telegramMessageId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogReviewProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogReviewProposal_cuit_idx" ON "CatalogReviewProposal"("cuit");
