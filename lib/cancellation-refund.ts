import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { sendCancellationApprovedEmail } from "@/lib/cancellation-notifications";

export class CancellationApprovalError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "not_pending"
      | "already_refunded"
      | "payment_not_found"
      | "payment_already_refunded"
      | "processing_conflict",
    message: string
  ) {
    super(message);
    this.name = "CancellationApprovalError";
  }
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  return new Stripe(key);
}

export async function approveCancellationRequest(input: {
  requestId: string;
  reviewedById?: string | null;
  adminNote?: string | null;
}) {
  const requestRecord = await prisma.cancellationRequest.findUnique({
    where: { id: input.requestId },
    include: {
      question: {
        select: {
          id: true,
          title: true,
          userId: true,
          rewardAmount: true,
          purchases: {
            where: { kind: "question_post" },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              userId: true,
              amount: true,
              status: true,
              stripeSessionId: true,
            },
          },
        },
      },
      requester: {
        select: { email: true },
      },
    },
  });

  if (!requestRecord) {
    throw new CancellationApprovalError(
      "not_found",
      "キャンセル申請が見つかりません"
    );
  }

  if (requestRecord.status !== "pending") {
    throw new CancellationApprovalError(
      "not_pending",
      "pending の申請のみ承認できます"
    );
  }

  if (requestRecord.stripeRefundId) {
    throw new CancellationApprovalError(
      "already_refunded",
      "この申請はすでに返金処理済みです"
    );
  }

  const targetPurchase = requestRecord.question.purchases.find(
    (purchase) => purchase.userId === requestRecord.question.userId
  );

  if (!targetPurchase?.stripeSessionId) {
    throw new CancellationApprovalError(
      "payment_not_found",
      "返金対象の決済情報が見つかりません"
    );
  }

  if (targetPurchase.status === "REFUNDED") {
    throw new CancellationApprovalError(
      "payment_already_refunded",
      "この質問投稿決済はすでに返金済みです"
    );
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(
    targetPurchase.stripeSessionId,
    { expand: ["payment_intent"] }
  );
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!paymentIntentId) {
    throw new CancellationApprovalError(
      "payment_not_found",
      "返金対象の決済情報が見つかりません"
    );
  }

  const refundedAmount = requestRecord.question.rewardAmount;
  const refund = await stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      amount: refundedAmount,
      metadata: {
        kind: "question_cancellation",
        cancellationRequestId: requestRecord.id,
        questionId: requestRecord.question.id,
      },
    },
    { idempotencyKey: `cancellation_request_reward_${requestRecord.id}` }
  );

  const reviewedAt = new Date();
  const adminNote = input.adminNote?.trim() || null;
  const updated = await prisma.$transaction(async (tx) => {
    const updatedRequest = await tx.cancellationRequest.updateMany({
      where: {
        id: requestRecord.id,
        status: "pending",
        stripeRefundId: null,
      },
      data: {
        status: "approved",
        adminNote,
        stripeRefundId: refund.id,
        reviewedAt,
        reviewedById: input.reviewedById ?? null,
      },
    });

    if (updatedRequest.count === 0) {
      return false;
    }

    await tx.question.update({
      where: { id: requestRecord.question.id },
      data: { isClosed: true },
    });
    await tx.purchase.update({
      where: { id: targetPurchase.id },
      data: { status: "REFUNDED" },
    });
    await tx.eventLog.create({
      data: {
        type: "question_cancellation_refund",
        payload: {
          cancellationRequestId: requestRecord.id,
          questionId: requestRecord.question.id,
          purchaseId: targetPurchase.id,
          stripeRefundId: refund.id,
          refundedAmount,
          retainedPlatformFee:
            Math.max(0, targetPurchase.amount - refundedAmount),
          reviewedById: input.reviewedById ?? null,
          automatic: !input.reviewedById,
        },
      },
    });

    return true;
  });

  if (!updated) {
    throw new CancellationApprovalError(
      "processing_conflict",
      "この申請はすでに処理されています"
    );
  }

  if (requestRecord.requester.email) {
    void sendCancellationApprovedEmail({
      to: requestRecord.requester.email,
      questionId: requestRecord.question.id,
      questionTitle: requestRecord.question.title,
      adminNote,
    });
  }

  return {
    refundId: refund.id,
    refundedAmount,
    questionId: requestRecord.question.id,
  };
}
