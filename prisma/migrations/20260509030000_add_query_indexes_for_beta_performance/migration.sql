CREATE INDEX "Question_createdAt_idx" ON "Question"("createdAt");

CREATE INDEX "Question_userId_createdAt_idx" ON "Question"("userId", "createdAt");

CREATE INDEX "Question_categoryId_createdAt_idx" ON "Question"("categoryId", "createdAt");

CREATE INDEX "Question_isPaid_createdAt_idx" ON "Question"("isPaid", "createdAt");

CREATE INDEX "Question_bestAnswerId_idx" ON "Question"("bestAnswerId");

CREATE INDEX "Answer_questionId_createdAt_idx" ON "Answer"("questionId", "createdAt");

CREATE INDEX "Answer_userId_createdAt_idx" ON "Answer"("userId", "createdAt");

CREATE INDEX "Negotiation_questionId_status_idx" ON "Negotiation"("questionId", "status");

CREATE INDEX "Purchase_userId_createdAt_idx" ON "Purchase"("userId", "createdAt");

CREATE INDEX "Purchase_userId_questionId_status_idx" ON "Purchase"("userId", "questionId", "status");

CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
