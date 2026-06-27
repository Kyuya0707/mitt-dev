-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "stripeChargeId" TEXT;
ALTER TABLE "Purchase" ADD COLUMN     "transferGroup" TEXT;

-- AlterTable
ALTER TABLE "BestViewPayout" ADD COLUMN     "stripeChargeId" TEXT;
ALTER TABLE "BestViewPayout" ADD COLUMN     "transferGroup" TEXT;

-- AlterTable
ALTER TABLE "Payout" DROP CONSTRAINT IF EXISTS "Payout_answerId_key";
ALTER TABLE "Payout" ADD COLUMN     "stripeChargeId" TEXT;
ALTER TABLE "Payout" ADD COLUMN     "transferGroup" TEXT;

-- CreateIndex
CREATE INDEX "Purchase_stripeChargeId_idx" ON "Purchase"("stripeChargeId");

-- CreateIndex
CREATE INDEX "Purchase_transferGroup_idx" ON "Purchase"("transferGroup");

-- CreateIndex
CREATE INDEX "BestViewPayout_stripeChargeId_idx" ON "BestViewPayout"("stripeChargeId");

-- CreateIndex
CREATE INDEX "BestViewPayout_transferGroup_idx" ON "BestViewPayout"("transferGroup");

-- CreateIndex
CREATE INDEX "Payout_stripeChargeId_idx" ON "Payout"("stripeChargeId");

-- CreateIndex
CREATE INDEX "Payout_transferGroup_idx" ON "Payout"("transferGroup");
