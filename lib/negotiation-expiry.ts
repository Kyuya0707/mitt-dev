import Stripe from "stripe";
import prisma from "@/lib/prisma";
import {
  NOTIFICATION_TYPES,
  safeCreateUserNotification,
} from "@/lib/notifications";
import { getSafeErrorMessage } from "@/lib/safe-error";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

async function expireOne(negotiation: {
  id: string;
  questionId: string;
  answer: { userId: string | null };
  question: { title: string; userId: string | null };
  purchase: {
    id: string;
    amount: number;
    stripeSessionId: string | null;
  } | null;
}) {
  if (
    !negotiation.question.userId ||
    !negotiation.answer.userId ||
    !negotiation.purchase?.stripeSessionId
  ) {
    throw new Error("negotiation expiry payment data not found");
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(
    negotiation.purchase.stripeSessionId,
    { expand: ["payment_intent"] }
  );
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!paymentIntentId) throw new Error("negotiation payment intent not found");

  const refund = await stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      amount: negotiation.purchase.amount,
      metadata: { kind: "negotiation_expired", negotiationId: negotiation.id },
    },
    { idempotencyKey: `negotiation_expired_${negotiation.id}` }
  );

  const updated = await prisma.$transaction(async (tx) => {
    const expired = await tx.negotiation.updateMany({
      where: { id: negotiation.id, status: "ACCEPTED", submittedAt: null },
      data: { status: "EXPIRED", stripeRefundId: refund.id },
    });
    if (expired.count === 0) return false;
    await tx.purchase.update({
      where: { id: negotiation.purchase!.id },
      data: { status: "REFUNDED" },
    });
    await tx.eventLog.create({
      data: {
        type: "negotiation_expired_refund",
        payload: {
          negotiationId: negotiation.id,
          questionId: negotiation.questionId,
          purchaseId: negotiation.purchase!.id,
          stripeRefundId: refund.id,
          refundedAmount: negotiation.purchase!.amount,
        },
      },
    });
    return true;
  });
  if (!updated) return false;

  await Promise.all([
    safeCreateUserNotification({
      userId: negotiation.question.userId,
      type: NOTIFICATION_TYPES.NEGOTIATION_EXPIRED,
      message: `「${negotiation.question.title}」の交渉回答が7日以内に投稿されなかったため、追加決済${negotiation.purchase.amount.toLocaleString("ja-JP")}円を全額返金しました。`,
      url: `/questions/${negotiation.questionId}`,
      data: { questionId: negotiation.questionId, negotiationId: negotiation.id },
      dedupeKey: `negotiation-expired-asker:${negotiation.id}`,
      mandatoryEmail: true,
      context: "negotiation_expired_asker",
    }),
    safeCreateUserNotification({
      userId: negotiation.answer.userId,
      type: NOTIFICATION_TYPES.NEGOTIATION_EXPIRED,
      message: `「${negotiation.question.title}」の交渉回答期限が終了しました。追加報酬は質問者へ返金されました。`,
      url: `/questions/${negotiation.questionId}`,
      data: { questionId: negotiation.questionId, negotiationId: negotiation.id },
      dedupeKey: `negotiation-expired-answerer:${negotiation.id}`,
      context: "negotiation_expired_answerer",
    }),
  ]);

  return true;
}

export async function expireOverdueNegotiations(now = new Date()) {
  const candidates = await prisma.negotiation.findMany({
    where: {
      status: "ACCEPTED",
      submittedAt: null,
      answerDueAt: { lte: now },
    },
    select: {
      id: true,
      questionId: true,
      answer: { select: { userId: true } },
      question: { select: { title: true, userId: true } },
      purchase: {
        select: { id: true, amount: true, stripeSessionId: true },
      },
    },
    take: 200,
  });

  let expiredCount = 0;
  const errors: Array<{ negotiationId: string; message: string }> = [];
  for (const negotiation of candidates) {
    try {
      if (await expireOne(negotiation)) expiredCount += 1;
    } catch (error) {
      errors.push({
        negotiationId: negotiation.id,
        message: getSafeErrorMessage(error),
      });
    }
  }
  return { checkedCount: candidates.length, expiredCount, errors };
}
