-- AlterTable
ALTER TABLE "Payout"
ADD COLUMN     "grossAmount" INTEGER,
ADD COLUMN     "platformFeeAmount" INTEGER,
ADD COLUMN     "netAmount" INTEGER;
