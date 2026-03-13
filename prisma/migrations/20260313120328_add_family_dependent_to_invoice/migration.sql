/*
  Warnings:

  - You are about to drop the column `ownsProperty` on the `UserPreference` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'PULL_FAMILY_DEPENDENTS';

-- DropIndex
DROP INDEX "FamilyDependent_userId_idx";

-- AlterTable
ALTER TABLE "AutomationJob" ADD COLUMN     "fiscalYear" INTEGER,
ADD COLUMN     "resultData" JSONB;

-- AlterTable
ALTER TABLE "FamilyDependent" ADD COLUMN     "fiscalYear" INTEGER NOT NULL DEFAULT 2025;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "familyDependentId" TEXT;

-- AlterTable
ALTER TABLE "UserPreference" DROP COLUMN "ownsProperty";

-- CreateTable
CREATE TABLE "UserYearPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "ownsProperty" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserYearPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserYearPreference_userId_fiscalYear_key" ON "UserYearPreference"("userId", "fiscalYear");

-- CreateIndex
CREATE INDEX "FamilyDependent_userId_fiscalYear_idx" ON "FamilyDependent"("userId", "fiscalYear");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_familyDependentId_fkey" FOREIGN KEY ("familyDependentId") REFERENCES "FamilyDependent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserYearPreference" ADD CONSTRAINT "UserYearPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
