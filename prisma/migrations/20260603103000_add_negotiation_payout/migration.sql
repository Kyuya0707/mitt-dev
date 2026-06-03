-- AlterTable
ALTER TABLE "Payout" DROP CONSTRAINT IF EXISTS "Payout_answerId_key";

ALTER TABLE "Payout" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'question_reward';
ALTER TABLE "Payout" ADD COLUMN     "negotiationId" TEXT;
ALTER TABLE "Payout" ADD COLUMN     "description" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payout_answerId_kind_key" ON "Payout"("answerId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_negotiationId_key" ON "Payout"("negotiationId");

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_negotiationId_fkey" FOREIGN KEY ("negotiationId") REFERENCES "Negotiation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
