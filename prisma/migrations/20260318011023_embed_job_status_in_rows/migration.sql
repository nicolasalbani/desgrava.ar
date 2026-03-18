-- DropForeignKey
ALTER TABLE "AutomationJob" DROP CONSTRAINT "AutomationJob_invoiceId_fkey";

-- CreateTable
CREATE TABLE "_AutomationJobToDomesticReceipt" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AutomationJobToDomesticReceipt_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AutomationJobToDomesticReceipt_B_index" ON "_AutomationJobToDomesticReceipt"("B");

-- AddForeignKey
ALTER TABLE "AutomationJob" ADD CONSTRAINT "AutomationJob_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AutomationJobToDomesticReceipt" ADD CONSTRAINT "_AutomationJobToDomesticReceipt_A_fkey" FOREIGN KEY ("A") REFERENCES "AutomationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AutomationJobToDomesticReceipt" ADD CONSTRAINT "_AutomationJobToDomesticReceipt_B_fkey" FOREIGN KEY ("B") REFERENCES "DomesticReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
