import { NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getCurrentUserAdminStatus } from "@/lib/admin";
import { getQuestionRewardBreakdown } from "@/lib/reward-breakdown";
import { sendCancellationApprovedEmail } from "@/lib/cancellation-notifications";
import { getSafeErrorMessage } from "@/lib/safe-error";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  return new Stripe(key);
}

function mapRefundErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Stripe返金処理に失敗しました";
  const normalized = message.toLowerCase();

  if (normalized.includes("already") && normalized.includes("refund")) {
    return "すでに返金済みです";
  }

  if (normalized.includes("payment_intent")) {
    return "返金対象の決済情報が見つかりません";
  }

  return "Stripe返金処理に失敗しました";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, isAdmin } = await getCurrentUserAdminStatus();

  if (!user) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }

  if (!isAdmin) {
    return NextResponse.json({ error: "管理者のみ利用できます" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    adminNote?: string | null;
  };

  const requestRecord = await prisma.cancellationRequest.findUnique({
    where: { id },
    include: {
      question: {
        select: {
          id: true,
          title: true,
          userId: true,
          rewardAmount: true,
          purchases: {
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
        select: {
          email: true,
        },
      },
    },
  });

  if (!requestRecord) {
    return NextResponse.json(
      { error: "キャンセル申請が見つかりません" },
      { status: 404 }
    );
  }

  if (requestRecord.status !== "pending") {
    return NextResponse.json(
      { error: "pending の申請のみ承認できます" },
      { status: 400 }
    );
  }

  if (requestRecord.stripeRefundId) {
    return NextResponse.json(
      { error: "この申請はすでに返金処理済みです" },
      { status: 400 }
    );
  }

  const targetPurchase = requestRecord.question.purchases.find(
    (purchase) => purchase.userId === requestRecord.question.userId
  );

  const rewardBreakdown = getQuestionRewardBreakdown(
    requestRecord.question.rewardAmount
  );

  if (!targetPurchase?.stripeSessionId) {
    return NextResponse.json(
      { error: "返金対象の決済情報が見つかりません" },
      { status: 400 }
    );
  }

  if (targetPurchase.status === "REFUNDED") {
    return NextResponse.json(
      { error: "この質問投稿決済はすでに返金済みです" },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(
      targetPurchase.stripeSessionId,
      {
        expand: ["payment_intent"],
      }
    );

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "返金対象の決済情報が見つかりません" },
        { status: 400 }
      );
    }

    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
      },
      {
        idempotencyKey: `cancellation_request_${requestRecord.id}`,
      }
    );

    const reviewedAt = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.cancellationRequest.updateMany({
        where: {
          id: requestRecord.id,
          status: "pending",
          stripeRefundId: null,
        },
        data: {
          status: "approved",
          adminNote: body.adminNote?.trim() || null,
          stripeRefundId: refund.id,
          reviewedAt,
          reviewedById: user.id,
        },
      });

      if (updatedRequest.count === 0) {
        return false;
      }

      await tx.question.update({
        where: { id: requestRecord.question.id },
        data: {
          isClosed: true,
        },
      });

      await tx.purchase.update({
        where: { id: targetPurchase.id },
        data: {
          status: "REFUNDED",
          amount: targetPurchase.amount || rewardBreakdown.checkoutAmount,
        },
      });

      return true;
    });

    if (!updated) {
      return NextResponse.json(
        { error: "この申請はすでに処理されています" },
        { status: 409 }
      );
    }

    if (requestRecord.requester.email) {
      void sendCancellationApprovedEmail({
        to: requestRecord.requester.email,
        questionId: requestRecord.question.id,
        questionTitle: requestRecord.question.title,
        adminNote: body.adminNote?.trim() || null,
      });
    }

    return NextResponse.json({
      ok: true,
      refundId: refund.id,
      refundedAmount: targetPurchase.amount || rewardBreakdown.checkoutAmount,
    });
  } catch (error) {
    console.error("Cancellation approve refund error:", {
      message: getSafeErrorMessage(error),
    });
    return NextResponse.json(
      { error: mapRefundErrorMessage(error) },
      { status: 500 }
    );
  }
}
