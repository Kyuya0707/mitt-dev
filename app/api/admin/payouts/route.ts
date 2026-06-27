import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserAdminStatus } from "@/lib/admin";

export async function GET() {
  const { user, isAdmin } = await getCurrentUserAdminStatus();

  if (!user) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }

  if (!isAdmin) {
    return NextResponse.json({ error: "管理者のみ利用できます" }, { status: 403 });
  }

  const payouts = await prisma.payout.findMany({
    where: {
      status: {
        in: ["pending", "failed", "processing"],
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          stripeAccountId: true,
          stripeConnectPayoutsEnabled: true,
          stripeConnectDetailsSubmitted: true,
        },
      },
      question: {
        select: {
          id: true,
          title: true,
        },
      },
      answer: {
        select: {
          id: true,
          questionId: true,
        },
      },
    },
  });

  return NextResponse.json({
    payouts: payouts.map((payout) => ({
      id: payout.id,
      createdAt: payout.createdAt.toISOString(),
      updatedAt: payout.updatedAt.toISOString(),
      userId: payout.userId,
      questionId: payout.questionId ?? payout.answer?.questionId ?? null,
      answerId: payout.answerId,
      grossAmount: payout.grossAmount,
      platformFeeAmount: payout.platformFeeAmount,
      netAmount: payout.netAmount,
      amount: payout.amount,
      currency: payout.currency,
      kind: payout.kind,
      description: payout.description,
      negotiationId: payout.negotiationId,
      stripeChargeId: payout.stripeChargeId,
      transferGroup: payout.transferGroup,
      status: payout.status,
      stripeAccountId: payout.stripeAccountId,
      stripeTransferId: payout.stripeTransferId,
      transferredAt: payout.transferredAt?.toISOString() ?? null,
      failureReason: payout.failureReason,
      user: {
        id: payout.user.id,
        email: payout.user.email,
        username: payout.user.username,
        stripeAccountId: payout.user.stripeAccountId,
        stripeConnectPayoutsEnabled: payout.user.stripeConnectPayoutsEnabled,
        stripeConnectDetailsSubmitted:
          payout.user.stripeConnectDetailsSubmitted,
      },
      question: payout.question,
      answer: payout.answer,
    })),
  });
}

export const dynamic = "force-dynamic";
