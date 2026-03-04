/*
  Warnings:

  - Added the required column `questionId` to the `Negotiation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'ABUSE', 'AI_CONTENT', 'FALSE_INFORMATION');

-- AlterEnum
ALTER TYPE "NegotiationStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "Negotiation" ADD COLUMN     "expectedDays" INTEGER,
ADD COLUMN     "questionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "boostCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deadlineAt" TIMESTAMP(3),
ADD COLUMN     "viewerPrice" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "rank" TEXT NOT NULL DEFAULT 'WHITE',
ADD COLUMN     "trustScore" INTEGER NOT NULL DEFAULT 50;

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" "ReportReason" NOT NULL,
    "reporterId" TEXT NOT NULL,
    "answerId" TEXT,
    "questionId" TEXT,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Negotiation" ADD CONSTRAINT "Negotiation_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;
