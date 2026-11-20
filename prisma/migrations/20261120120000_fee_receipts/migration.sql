-- AlterTable
ALTER TABLE "FeePayment" ADD COLUMN "receiptNo" TEXT;
ALTER TABLE "FeePayment" ADD COLUMN "recordedBy" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FeePayment_receiptNo_key" ON "FeePayment"("receiptNo");

