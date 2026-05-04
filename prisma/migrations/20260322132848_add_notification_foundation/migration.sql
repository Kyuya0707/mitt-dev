-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "data" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "interestCategories" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailOnAnswerCreated" BOOLEAN NOT NULL DEFAULT true,
    "emailOnCommentCreated" BOOLEAN NOT NULL DEFAULT true,
    "emailOnBestSelected" BOOLEAN NOT NULL DEFAULT true,
    "emailOnNegotiationCreated" BOOLEAN NOT NULL DEFAULT true,
    "emailOnNegotiationAccepted" BOOLEAN NOT NULL DEFAULT true,
    "emailOnCategoryQuestionCreated" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
