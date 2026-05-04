-- AlterTable
ALTER TABLE "User"
ADD COLUMN     "stripeAccountId" TEXT,
ADD COLUMN     "stripeConnectOnboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeConnectChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeConnectPayoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeConnectDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeConnectRequirementsCurrentlyDue" JSONB,
ADD COLUMN     "stripeConnectRequirementsEventuallyDue" JSONB,
ADD COLUMN     "stripeConnectDisabledReason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeAccountId_key" ON "User"("stripeAccountId");
