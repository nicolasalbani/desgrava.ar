-- AlterTable
ALTER TABLE "AutomationJob" ADD COLUMN     "notifyOnComplete" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN     "lastComprobantesNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "lastRecibosNotifiedAt" TIMESTAMP(3);
