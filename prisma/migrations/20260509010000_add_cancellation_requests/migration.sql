CREATE TYPE "CancellationRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "CancellationRequest" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "status" "CancellationRequestStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "adminNote" TEXT,
    "stripeRefundId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "CancellationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CancellationRequest_questionId_idx" ON "CancellationRequest"("questionId");
CREATE INDEX "CancellationRequest_requesterUserId_idx" ON "CancellationRequest"("requesterUserId");
CREATE INDEX "CancellationRequest_status_idx" ON "CancellationRequest"("status");

ALTER TABLE "CancellationRequest"
ADD CONSTRAINT "CancellationRequest_questionId_fkey"
FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CancellationRequest"
ADD CONSTRAINT "CancellationRequest_requesterUserId_fkey"
FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CancellationRequest"
ADD CONSTRAINT "CancellationRequest_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
