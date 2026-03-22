-- CreateEnum
CREATE TYPE "PresentacionSource" AS ENUM ('ARCA_IMPORT', 'AUTOMATION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobType" ADD VALUE 'PULL_PRESENTACIONES';
ALTER TYPE "JobType" ADD VALUE 'SUBMIT_PRESENTACION';

-- AlterTable
ALTER TABLE "AutomationJob" ADD COLUMN     "presentacionId" TEXT;

-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN     "autoSubmitDay" INTEGER,
ADD COLUMN     "autoSubmitEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Presentacion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fechaEnvio" TIMESTAMP(3) NOT NULL,
    "fechaLectura" TIMESTAMP(3),
    "montoTotal" DECIMAL(12,2),
    "source" "PresentacionSource" NOT NULL,
    "siradiqStatus" "SiradiqStatus" NOT NULL DEFAULT 'SUBMITTED',
    "fileData" BYTEA,
    "fileMimeType" TEXT,
    "originalFilename" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Presentacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Presentacion_userId_fiscalYear_idx" ON "Presentacion"("userId", "fiscalYear");

-- CreateIndex
CREATE UNIQUE INDEX "Presentacion_userId_fiscalYear_numero_key" ON "Presentacion"("userId", "fiscalYear", "numero");

-- AddForeignKey
ALTER TABLE "AutomationJob" ADD CONSTRAINT "AutomationJob_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "Presentacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presentacion" ADD CONSTRAINT "Presentacion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
