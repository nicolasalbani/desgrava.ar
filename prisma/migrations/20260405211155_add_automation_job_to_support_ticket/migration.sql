-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "automationJobId" TEXT;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_automationJobId_fkey" FOREIGN KEY ("automationJobId") REFERENCES "AutomationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
