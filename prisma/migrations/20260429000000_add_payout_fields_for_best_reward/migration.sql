-- AlterTable
ALTER TABLE "Payout"
ADD COLUMN     "answerId" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'jpy',
ADD COLUMN     "stripeAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payout_answerId_key" ON "Payout"("answerId");

-- AddForeignKey
ALTER TABLE "Payout"
ADD CONSTRAINT "Payout_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
