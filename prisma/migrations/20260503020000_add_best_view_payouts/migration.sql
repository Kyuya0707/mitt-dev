-- CreateTable
CREATE TABLE "BestViewPayout" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revenueShareId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'jpy',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "stripeAccountId" TEXT,
    "stripeTransferId" TEXT,
    "transferredAt" TIMESTAMP(3),
    "failureReason" TEXT,

    CONSTRAINT "BestViewPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BestViewPayout_stripeTransferId_key" ON "BestViewPayout"("stripeTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "BestViewPayout_revenueShareId_recipientType_key" ON "BestViewPayout"("revenueShareId", "recipientType");

-- AddForeignKey
ALTER TABLE "BestViewPayout" ADD CONSTRAINT "BestViewPayout_revenueShareId_fkey" FOREIGN KEY ("revenueShareId") REFERENCES "BestViewRevenueShare"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BestViewPayout" ADD CONSTRAINT "BestViewPayout_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill
INSERT INTO "BestViewPayout" (
    "id",
    "createdAt",
    "updatedAt",
    "revenueShareId",
    "recipientUserId",
    "recipientType",
    "amount",
    "currency",
    "status"
)
SELECT
    ('bvp_' || rs."id" || '_question_owner'),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    rs."id",
    rs."questionOwnerId",
    'question_owner',
    rs."questionOwnerAmount",
    rs."currency",
    'pending'
FROM "BestViewRevenueShare" rs
WHERE NOT EXISTS (
    SELECT 1
    FROM "BestViewPayout" p
    WHERE p."revenueShareId" = rs."id"
      AND p."recipientType" = 'question_owner'
);

INSERT INTO "BestViewPayout" (
    "id",
    "createdAt",
    "updatedAt",
    "revenueShareId",
    "recipientUserId",
    "recipientType",
    "amount",
    "currency",
    "status"
)
SELECT
    ('bvp_' || rs."id" || '_answer_owner'),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    rs."id",
    rs."answerOwnerId",
    'answer_owner',
    rs."answerOwnerAmount",
    rs."currency",
    'pending'
FROM "BestViewRevenueShare" rs
WHERE NOT EXISTS (
    SELECT 1
    FROM "BestViewPayout" p
    WHERE p."revenueShareId" = rs."id"
      AND p."recipientType" = 'answer_owner'
);
