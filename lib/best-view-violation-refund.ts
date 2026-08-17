import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { NOTIFICATION_TYPES, safeCreateUserNotification } from "@/lib/notifications";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

export async function refundBestViewPurchasesForViolatedAnswer(input: {
  answerId: string;
  reportId: string;
  reviewedById: string;
}) {
  const answer = await prisma.answer.findUnique({
    where: { id: input.answerId },
    select: { questionId: true, question: { select: { bestAnswerId: true } } },
  });
  if (!answer || answer.question.bestAnswerId !== input.answerId) {
    return { refundedCount: 0, failedCount: 0 };
  }
  const purchases = await prisma.purchase.findMany({
    where: { questionId: answer.questionId, kind: "best_view", status: "PAID" },
    select: {
      id: true, userId: true, amount: true, stripeSessionId: true,
      bestViewRevenueShare: { select: { id: true } },
    },
  });
  const stripe = getStripe();
  let refundedCount = 0;
  let failedCount = 0;
  for (const purchase of purchases) {
    try {
      if (!purchase.stripeSessionId) throw new Error("stripe session missing");
      const session = await stripe.checkout.sessions.retrieve(purchase.stripeSessionId, {
        expand: ["payment_intent"],
      });
      const paymentIntent = typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
      if (!paymentIntent) throw new Error("payment intent missing");
      const refund = await stripe.refunds.create(
        {
          payment_intent: paymentIntent,
          amount: purchase.amount,
          metadata: { kind: "best_view_violation", purchaseId: purchase.id, reportId: input.reportId },
        },
        { idempotencyKey: `best_view_violation_${purchase.id}_${input.reportId}` }
      );
      await prisma.$transaction(async (tx) => {
        await tx.purchase.update({ where: { id: purchase.id }, data: { status: "REFUNDED" } });
        if (purchase.bestViewRevenueShare) {
          const affectedBatchItems = await tx.payoutBatchItem.findMany({
            where: {
              bestViewPayout: {
                revenueShareId: purchase.bestViewRevenueShare.id,
                status: { not: "paid" },
              },
              batch: { status: { in: ["scheduled", "failed"] } },
            },
            select: { id: true, batchId: true },
          });
          if (affectedBatchItems.length > 0) {
            await tx.payoutBatchItem.deleteMany({
              where: { id: { in: affectedBatchItems.map((item) => item.id) } },
            });
            for (const batchId of new Set(affectedBatchItems.map((item) => item.batchId))) {
              const remaining = await tx.payoutBatchItem.findMany({
                where: { batchId },
                select: { amount: true, payoutId: true, bestViewPayoutId: true },
              });
              const amount = remaining.reduce((sum, item) => sum + item.amount, 0);
              if (amount < 5000) {
                await tx.payout.updateMany({
                  where: { id: { in: remaining.flatMap((item) => item.payoutId ? [item.payoutId] : []) } },
                  data: { status: "pending" },
                });
                await tx.bestViewPayout.updateMany({
                  where: { id: { in: remaining.flatMap((item) => item.bestViewPayoutId ? [item.bestViewPayoutId] : []) } },
                  data: { status: "pending" },
                });
                await tx.payoutBatch.delete({ where: { id: batchId } });
              } else {
                await tx.payoutBatch.update({ where: { id: batchId }, data: { amount } });
              }
            }
          }
          await tx.bestViewRevenueShare.update({
            where: { id: purchase.bestViewRevenueShare.id }, data: { status: "refunded" },
          });
          await tx.bestViewPayout.updateMany({
            where: { revenueShareId: purchase.bestViewRevenueShare.id, status: { not: "paid" } },
            data: { status: "cancelled", failureReason: "規約違反による購入全額返金" },
          });
        }
        await tx.eventLog.create({
          data: {
            type: "best_view_violation_refund",
            payload: {
              purchaseId: purchase.id, answerId: input.answerId, reportId: input.reportId,
              stripeRefundId: refund.id, amount: purchase.amount, reviewedById: input.reviewedById,
            },
          },
        });
      });
      await safeCreateUserNotification({
        userId: purchase.userId,
        type: NOTIFICATION_TYPES.BEST_VIEW_REFUNDED,
        message: `購入したBEST回答が規約違反により非公開となったため、${purchase.amount.toLocaleString("ja-JP")}円を全額返金しました。`,
        url: "/mypage/purchases",
        data: { questionId: answer.questionId, answerId: input.answerId },
        dedupeKey: `best-view-refunded:${purchase.id}`,
        mandatoryEmail: true,
        context: "best_view_violation_refund",
      });
      refundedCount += 1;
    } catch (error) {
      failedCount += 1;
      await prisma.eventLog.create({
        data: {
          type: "best_view_violation_refund_failed",
          payload: {
            purchaseId: purchase.id, reportId: input.reportId,
            message: error instanceof Error ? error.message : "unknown error",
          },
        },
      });
    }
  }
  return { refundedCount, failedCount };
}
