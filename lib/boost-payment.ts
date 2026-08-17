import Stripe from "stripe";
import prisma from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

export async function verifyBoostCheckoutSession(input: {
  session?: Stripe.Checkout.Session;
  sessionId?: string;
  expectedQuestionId?: string;
}) {
  const session =
    input.session ??
    (input.sessionId
      ? await getStripe().checkout.sessions.retrieve(input.sessionId)
      : null);

  if (!session || session.metadata?.kind !== "question_boost") {
    return { ok: false as const, reason: "invalid_session" };
  }

  const questionId = session.metadata.questionId;
  const userId = session.metadata.userId;
  if (
    !questionId ||
    !userId ||
    (input.expectedQuestionId && input.expectedQuestionId !== questionId)
  ) {
    return { ok: false as const, reason: "invalid_metadata" };
  }

  if (session.payment_status !== "paid") {
    return { ok: true as const, isPaid: false, questionId, updated: false };
  }

  const existing = await prisma.purchase.findUnique({
    where: { stripeSessionId: session.id },
    select: { id: true },
  });
  if (existing) {
    return { ok: true as const, isPaid: true, questionId, updated: false };
  }

  const question = await prisma.question.findFirst({
    where: {
      id: questionId,
      userId,
      isPaid: true,
      isClosed: false,
      rewardAmount: { gte: 3000 },
      boostCount: { lt: 3 },
      cancellationRequests: { none: { status: "approved" } },
    },
    select: {
      id: true,
      rewardAmount: true,
      answerDeadline: true,
    },
  });
  if (!question) {
    return { ok: false as const, reason: "question_not_eligible" };
  }

  const expectedAmount = Math.floor(question.rewardAmount * 0.1);
  if (session.amount_total !== expectedAmount) {
    return { ok: false as const, reason: "amount_mismatch" };
  }

  const now = new Date();
  const boostExpiresAt = new Date(now.getTime() + 3 * DAY_MS);
  const minimumBoostDeadline = new Date(now.getTime() + 7 * DAY_MS);
  const shortenDeadline = session.metadata.shortenDeadline === "true";
  const nextAnswerDeadline =
    shortenDeadline &&
    question.answerDeadline &&
    question.answerDeadline > minimumBoostDeadline
      ? minimumBoostDeadline
      : question.answerDeadline;

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.question.updateMany({
      where: { id: question.id, boostCount: { lt: 3 }, isClosed: false },
      data: {
        boostCount: { increment: 1 },
        boostedAt: now,
        boostExpiresAt,
        ...(nextAnswerDeadline &&
        question.answerDeadline &&
        nextAnswerDeadline < question.answerDeadline
          ? { answerDeadline: nextAnswerDeadline }
          : {}),
      },
    });
    if (updated.count === 0) return false;

    await tx.purchase.create({
      data: {
        userId,
        questionId,
        kind: "question_boost",
        amount: expectedAmount,
        currency: (session.currency ?? "jpy").toLowerCase(),
        stripeSessionId: session.id,
        status: "PAID",
      },
    });
    await tx.eventLog.create({
      data: {
        type: "question_boost_purchased",
        payload: {
          questionId,
          userId,
          amount: expectedAmount,
          boostExpiresAt: boostExpiresAt.toISOString(),
          answerDeadlineShortened: nextAnswerDeadline !== question.answerDeadline,
        },
      },
    });
    return true;
  });

  return { ok: true as const, isPaid: true, questionId, updated: result };
}
