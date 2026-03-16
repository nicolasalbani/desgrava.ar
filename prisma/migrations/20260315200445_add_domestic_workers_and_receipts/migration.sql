-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobType" ADD VALUE 'PULL_DOMESTIC_RECEIPTS';
ALTER TYPE "JobType" ADD VALUE 'SUBMIT_DOMESTIC_DEDUCTION';

-- CreateTable
CREATE TABLE "DomesticWorker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "cuil" TEXT NOT NULL,
    "apellidoNombre" TEXT NOT NULL,
    "tipoTrabajo" TEXT NOT NULL,
    "domicilioLaboral" TEXT,
    "horasSemanales" TEXT,
    "condicion" TEXT NOT NULL DEFAULT 'Activo',
    "obraSocial" TEXT,
    "fechaNacimiento" TEXT,
    "fechaIngreso" TEXT,
    "modalidadPago" TEXT,
    "modalidadTrabajo" TEXT,
    "remuneracionPactada" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomesticWorker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomesticReceipt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domesticWorkerId" TEXT,
    "fiscalYear" INTEGER NOT NULL,
    "fiscalMonth" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "categoriaProfesional" TEXT,
    "modalidadPrestacion" TEXT,
    "horasSemanales" TEXT,
    "modalidadLiquidacion" TEXT,
    "totalHorasTrabajadas" TEXT,
    "basico" DECIMAL(12,2),
    "antiguedad" DECIMAL(12,2),
    "viaticos" DECIMAL(12,2),
    "presentismo" DECIMAL(12,2),
    "otros" DECIMAL(12,2),
    "total" DECIMAL(12,2) NOT NULL,
    "paymentDetails" JSONB,
    "contributionAmount" DECIMAL(12,2),
    "contributionDate" TEXT,
    "source" "InvoiceSource" NOT NULL DEFAULT 'MANUAL',
    "ocrConfidence" DOUBLE PRECISION,
    "siradiqStatus" "SiradiqStatus" NOT NULL DEFAULT 'PENDING',
    "originalFilename" TEXT,
    "fileData" BYTEA,
    "fileMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomesticReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DomesticWorker_userId_fiscalYear_idx" ON "DomesticWorker"("userId", "fiscalYear");

-- CreateIndex
CREATE UNIQUE INDEX "DomesticWorker_userId_fiscalYear_cuil_key" ON "DomesticWorker"("userId", "fiscalYear", "cuil");

-- CreateIndex
CREATE INDEX "DomesticReceipt_userId_fiscalYear_idx" ON "DomesticReceipt"("userId", "fiscalYear");

-- CreateIndex
CREATE INDEX "DomesticReceipt_userId_siradiqStatus_idx" ON "DomesticReceipt"("userId", "siradiqStatus");

-- CreateIndex
CREATE UNIQUE INDEX "DomesticReceipt_userId_domesticWorkerId_fiscalYear_fiscalMo_key" ON "DomesticReceipt"("userId", "domesticWorkerId", "fiscalYear", "fiscalMonth");

-- AddForeignKey
ALTER TABLE "DomesticWorker" ADD CONSTRAINT "DomesticWorker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomesticReceipt" ADD CONSTRAINT "DomesticReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomesticReceipt" ADD CONSTRAINT "DomesticReceipt_domesticWorkerId_fkey" FOREIGN KEY ("domesticWorkerId") REFERENCES "DomesticWorker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
