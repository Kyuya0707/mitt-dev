import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserAdminStatus } from "@/lib/admin";
import { getQuestionRewardBreakdown } from "@/lib/reward-breakdown";

export async function GET() {
  const { user, isAdmin } = await getCurrentUserAdminStatus();

  if (!user) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }

  if (!isAdmin) {
    return NextResponse.json({ error: "管理者のみ利用できます" }, { status: 403 });
  }

  const requests = await prisma.cancellationRequest.findMany({
    where: {
      status: "pending",
    },
    orderBy: {
      requestedAt: "desc",
    },
    select: {
      id: true,
      status: true,
      reason: true,
      adminNote: true,
      stripeRefundId: true,
      requestedAt: true,
      reviewedAt: true,
      question: {
        select: {
          id: true,
          title: true,
          createdAt: true,
          rewardAmount: true,
          answers: {
            select: { id: true },
          },
          purchases: {
            where: {
              userId: {
                not: "",
              },
            },
            select: {
              id: true,
              userId: true,
              amount: true,
              status: true,
              stripeSessionId: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      requester: {
        select: {
          id: true,
          username: true,
          email: true,
          displayId: true,
        },
      },
    },
  });

  const payload = requests.map((request) => {
    const questionOwnerPurchase = request.question.purchases.find(
      (purchase) => purchase.userId === request.requester.id
    );
    const rewardBreakdown = getQuestionRewardBreakdown(request.question.rewardAmount);

    return {
      id: request.id,
      status: request.status,
      reason: request.reason,
      adminNote: request.adminNote,
      stripeRefundId: request.stripeRefundId,
      requestedAt: request.requestedAt.toISOString(),
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
      question: {
        id: request.question.id,
        title: request.question.title,
        createdAt: request.question.createdAt.toISOString(),
        rewardAmount: request.question.rewardAmount,
        checkoutAmount: questionOwnerPurchase?.amount ?? rewardBreakdown.checkoutAmount,
        answerCount: request.question.answers.length,
        purchaseId: questionOwnerPurchase?.id ?? null,
        stripeSessionId: questionOwnerPurchase?.stripeSessionId ?? null,
        purchaseStatus: questionOwnerPurchase?.status ?? null,
      },
      requester: request.requester,
    };
  });

  return NextResponse.json({ requests: payload });
}
