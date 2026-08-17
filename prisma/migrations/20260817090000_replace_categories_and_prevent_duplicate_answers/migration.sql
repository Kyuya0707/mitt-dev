-- Existing production questions and transactions were confirmed absent before this migration.
-- If a category is unexpectedly referenced, the delete fails instead of silently reclassifying data.
DELETE FROM "Category";

INSERT INTO "Category" ("id", "name", "createdAt")
VALUES
  ('cat_parenting', '育児・子育て', CURRENT_TIMESTAMP),
  ('cat_career_change', '転職・キャリア', CURRENT_TIMESTAMP),
  ('cat_programming_it', 'プログラミング・IT', CURRENT_TIMESTAMP),
  ('cat_workplace', '仕事術・職場の悩み', CURRENT_TIMESTAMP),
  ('cat_learning', '学習・資格', CURRENT_TIMESTAMP),
  ('cat_relationships', '恋愛・人間関係', CURRENT_TIMESTAMP),
  ('cat_living', '暮らし・家事', CURRENT_TIMESTAMP),
  ('cat_travel_local', '旅行・地域情報', CURRENT_TIMESTAMP),
  ('cat_hobbies', '趣味・創作', CURRENT_TIMESTAMP),
  ('cat_product_experience', '商品選び・購入体験', CURRENT_TIMESTAMP);

-- Old category preferences cannot be mapped safely to the new taxonomy.
UPDATE "User" SET "interestCategories" = ARRAY[]::TEXT[];

CREATE UNIQUE INDEX "Answer_questionId_userId_key"
ON "Answer"("questionId", "userId");

ALTER TABLE "User" ADD COLUMN "ageConfirmedAt" TIMESTAMP(3);

ALTER TABLE "Purchase" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'question_post';
CREATE INDEX "Purchase_userId_questionId_kind_status_idx"
ON "Purchase"("userId", "questionId", "kind", "status");

ALTER TABLE "Question"
ADD COLUMN "rewardPeriodStartedAt" TIMESTAMP(3),
ADD COLUMN "rewardExpiresAt" TIMESTAMP(3),
ADD COLUMN "rewardStoppedAt" TIMESTAMP(3);

ALTER TABLE "Question"
ADD COLUMN "boostedAt" TIMESTAMP(3),
ADD COLUMN "boostExpiresAt" TIMESTAMP(3);

CREATE INDEX "Question_isClosed_rewardExpiresAt_idx"
ON "Question"("isClosed", "rewardExpiresAt");
CREATE INDEX "Question_boostExpiresAt_createdAt_idx"
ON "Question"("boostExpiresAt", "createdAt");

ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

CREATE TABLE "QuestionSupplement" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestionSupplement_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "QuestionSupplement"
ADD CONSTRAINT "QuestionSupplement_questionId_fkey"
FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "QuestionSupplement_questionId_createdAt_idx"
ON "QuestionSupplement"("questionId", "createdAt");

ALTER TABLE "NotificationPreference"
ADD COLUMN "emailOnQuestionSupplement" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Negotiation"
ADD COLUMN "acceptedAt" TIMESTAMP(3),
ADD COLUMN "answerDueAt" TIMESTAMP(3),
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "stripeRefundId" TEXT;
CREATE INDEX "Negotiation_status_answerDueAt_idx"
ON "Negotiation"("status", "answerDueAt");

ALTER TABLE "Purchase" ADD COLUMN "negotiationId" TEXT;
CREATE UNIQUE INDEX "Purchase_negotiationId_key" ON "Purchase"("negotiationId");
ALTER TABLE "Purchase"
ADD CONSTRAINT "Purchase_negotiationId_fkey"
FOREIGN KEY ("negotiationId") REFERENCES "Negotiation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO storage.buckets (id, name, public)
VALUES ('answer-images-private', 'answer-images-private', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY "answer_images_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'answer-images-private'
  AND EXISTS (
    SELECT 1 FROM public."Answer" a
    WHERE a.id = split_part(storage.filename(name), '_', 1)
      AND a."userId" = auth.uid()::text
  )
);

CREATE POLICY "answer_images_authorized_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'answer-images-private'
  AND EXISTS (
    SELECT 1
    FROM public."Answer" a
    JOIN public."Question" q ON q.id = a."questionId"
    WHERE a.id = split_part(storage.filename(name), '_', 1)
      AND (
        a."userId" = auth.uid()::text
        OR q."userId" = auth.uid()::text
        OR (
          q."bestAnswerId" = a.id
          AND EXISTS (
            SELECT 1 FROM public."Purchase" p
            WHERE p."questionId" = q.id
              AND p."userId" = auth.uid()::text
              AND p.kind = 'best_view'
              AND p.status = 'PAID'
          )
        )
      )
  )
);

ALTER TYPE "ReportReason" ADD VALUE IF NOT EXISTS 'FINANCIAL_ADVICE';
ALTER TYPE "ReportReason" ADD VALUE IF NOT EXISTS 'FRAUD_FALSE';
ALTER TYPE "ReportReason" ADD VALUE IF NOT EXISTS 'HARASSMENT';
ALTER TYPE "ReportReason" ADD VALUE IF NOT EXISTS 'COPYRIGHT';
ALTER TYPE "ReportReason" ADD VALUE IF NOT EXISTS 'OTHER';

CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISMISSED');
CREATE TYPE "SanctionType" AS ENUM ('WARNING', 'SUSPEND_7_DAYS', 'SUSPEND_30_DAYS', 'PERMANENT');
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'UPHELD', 'OVERTURNED');

ALTER TABLE "User"
ADD COLUMN "suspendedUntil" TIMESTAMP(3),
ADD COLUMN "permanentlySuspendedAt" TIMESTAMP(3);
UPDATE "User" SET "rank" = 'SILVER' WHERE "rank" = 'WHITE';
ALTER TABLE "User" ALTER COLUMN "rank" SET DEFAULT 'SILVER';

DELETE FROM "Report";
ALTER TABLE "Report"
ADD COLUMN "details" TEXT,
ADD COLUMN "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "targetOwnerId" TEXT NOT NULL,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "resolutionNote" TEXT,
ADD COLUMN "commentId" TEXT;
ALTER TABLE "Report"
ADD CONSTRAINT "Report_targetOwnerId_fkey"
FOREIGN KEY ("targetOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Report"
ADD CONSTRAINT "Report_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report"
ADD CONSTRAINT "Report_commentId_fkey"
FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");
CREATE INDEX "Report_targetOwnerId_createdAt_idx" ON "Report"("targetOwnerId", "createdAt");

CREATE TABLE "Sanction" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "type" "SanctionType" NOT NULL,
  "reason" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "targetUserId" TEXT NOT NULL,
  "reviewedById" TEXT NOT NULL,
  "sourceReportId" TEXT,
  CONSTRAINT "Sanction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Sanction_sourceReportId_key" ON "Sanction"("sourceReportId");
CREATE INDEX "Sanction_targetUserId_createdAt_idx" ON "Sanction"("targetUserId", "createdAt");
ALTER TABLE "Sanction" ADD CONSTRAINT "Sanction_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sanction" ADD CONSTRAINT "Sanction_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sanction" ADD CONSTRAINT "Sanction_sourceReportId_fkey"
FOREIGN KEY ("sourceReportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Appeal" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "evidence" TEXT NOT NULL,
  "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "sanctionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reviewedById" TEXT,
  CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Appeal_sanctionId_createdAt_idx" ON "Appeal"("sanctionId", "createdAt");
CREATE INDEX "Appeal_status_createdAt_idx" ON "Appeal"("status", "createdAt");
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_sanctionId_fkey"
FOREIGN KEY ("sanctionId") REFERENCES "Sanction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TrustScoreHistory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "rank" TEXT NOT NULL,
  "dayKey" TEXT NOT NULL,
  "factors" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrustScoreHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TrustScoreHistory_userId_createdAt_idx"
ON "TrustScoreHistory"("userId", "createdAt");
CREATE UNIQUE INDEX "TrustScoreHistory_userId_dayKey_key"
ON "TrustScoreHistory"("userId", "dayKey");

CREATE TABLE "PayoutBatch" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "periodKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'jpy',
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "stripeAccountId" TEXT,
  "stripeTransferId" TEXT,
  "transferredAt" TIMESTAMP(3),
  "failureReason" TEXT,
  CONSTRAINT "PayoutBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayoutBatch_userId_periodKey_key" ON "PayoutBatch"("userId", "periodKey");
CREATE UNIQUE INDEX "PayoutBatch_stripeTransferId_key" ON "PayoutBatch"("stripeTransferId");
CREATE INDEX "PayoutBatch_status_createdAt_idx" ON "PayoutBatch"("status", "createdAt");
ALTER TABLE "PayoutBatch" ADD CONSTRAINT "PayoutBatch_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PayoutBatchItem" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "payoutId" TEXT,
  "bestViewPayoutId" TEXT,
  CONSTRAINT "PayoutBatchItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayoutBatchItem_payoutId_key" ON "PayoutBatchItem"("payoutId");
CREATE UNIQUE INDEX "PayoutBatchItem_bestViewPayoutId_key" ON "PayoutBatchItem"("bestViewPayoutId");
CREATE INDEX "PayoutBatchItem_batchId_idx" ON "PayoutBatchItem"("batchId");
ALTER TABLE "PayoutBatchItem" ADD CONSTRAINT "PayoutBatchItem_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "PayoutBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayoutBatchItem" ADD CONSTRAINT "PayoutBatchItem_payoutId_fkey"
FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayoutBatchItem" ADD CONSTRAINT "PayoutBatchItem_bestViewPayoutId_fkey"
FOREIGN KEY ("bestViewPayoutId") REFERENCES "BestViewPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User"
ADD COLUMN "bio" TEXT,
ADD COLUMN "experienceCategory" TEXT,
ADD COLUMN "experienceYears" INTEGER,
ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "category" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "adminNote" TEXT,
  "requesterId" TEXT NOT NULL,
  "assignedToId" TEXT,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportTicket_status_createdAt_idx" ON "SupportTicket"("status", "createdAt");
CREATE INDEX "SupportTicket_requesterId_createdAt_idx" ON "SupportTicket"("requesterId", "createdAt");
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_requesterId_fkey"
FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
