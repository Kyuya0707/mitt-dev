-- These tables are accessed only through the server-side Prisma connection.
-- Enabling RLS without public policies makes PostgREST access default-deny for
-- anon/authenticated clients while preserving access for the database owner.
ALTER TABLE public."Appeal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TrustScoreHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PayoutBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PayoutBatchItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."QuestionSupplement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Sanction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SupportTicket" ENABLE ROW LEVEL SECURITY;
