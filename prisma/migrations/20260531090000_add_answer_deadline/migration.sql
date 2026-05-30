-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "answerDeadline" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Question_answerDeadline_idx" ON "Question"("answerDeadline");

-- CreateIndex
CREATE INDEX "Question_isClosed_answerDeadline_idx" ON "Question"("isClosed", "answerDeadline");
