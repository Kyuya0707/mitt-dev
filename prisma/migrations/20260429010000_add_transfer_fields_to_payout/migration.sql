-- AlterTable
ALTER TABLE "Payout"
ADD COLUMN     "questionId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "stripeTransferId" TEXT,
ADD COLUMN     "transferredAt" TIMESTAMP(3),
ADD COLUMN     "failureReason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payout_stripeTransferId_key" ON "Payout"("stripeTransferId");

-- AddForeignKey
ALTER TABLE "Payout"
ADD CONSTRAINT "Payout_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill
UPDATE "Payout" AS p
SET "questionId" = a."questionId"
FROM "Answer" AS a
WHERE p."answerId" = a."id"
  AND p."questionId" IS NULL;
