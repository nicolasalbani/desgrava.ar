-- AlterTable
ALTER TABLE "AutomationJob" ADD COLUMN     "familyDependentId" TEXT;

-- AddForeignKey
ALTER TABLE "AutomationJob" ADD CONSTRAINT "AutomationJob_familyDependentId_fkey" FOREIGN KEY ("familyDependentId") REFERENCES "FamilyDependent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
