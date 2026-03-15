-- CreateEnum
CREATE TYPE "CatalogSource" AS ENUM ('AI_PDF', 'AI_WEB_LOOKUP', 'AI_INVOICE', 'MANUAL');

-- CreateTable
CREATE TABLE "ProviderCatalog" (
    "id" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "razonSocial" TEXT,
    "deductionCategory" "DeductionCategory" NOT NULL,
    "source" "CatalogSource" NOT NULL DEFAULT 'AI_INVOICE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderCatalog_cuit_key" ON "ProviderCatalog"("cuit");
