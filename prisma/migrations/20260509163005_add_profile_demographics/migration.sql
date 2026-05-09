-- AlterTable
ALTER TABLE "Payout" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ageGroup" TEXT,
ADD COLUMN     "gender" TEXT;
