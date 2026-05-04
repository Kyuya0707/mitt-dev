-- CreateTable
CREATE TABLE "BestViewRevenueShare" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "questionOwnerId" TEXT NOT NULL,
    "answerOwnerId" TEXT NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "questionOwnerAmount" INTEGER NOT NULL,
    "answerOwnerAmount" INTEGER NOT NULL,
    "platformFeeAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'jpy',
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "BestViewRevenueShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BestViewRevenueShare_purchaseId_key" ON "BestViewRevenueShare"("purchaseId");

-- AddForeignKey
ALTER TABLE "BestViewRevenueShare" ADD CONSTRAINT "BestViewRevenueShare_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
