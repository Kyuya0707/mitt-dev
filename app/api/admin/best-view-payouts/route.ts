import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserAdminStatus } from "@/lib/admin";

export async function GET() {
  const { user, canManageAccounting } = await getCurrentUserAdminStatus();

  if (!user) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }

  if (!canManageAccounting) {
    return NextResponse.json({ error: "管理者のみ利用できます" }, { status: 403 });
  }

  const payouts = await prisma.bestViewPayout.findMany({
    where: {
      status: {
        in: ["pending", "scheduled", "failed", "processing"],
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      recipientUser: {
        select: {
          id: true,
          email: true,
          username: true,
          stripeAccountId: true,
          stripeConnectPayoutsEnabled: true,
          stripeConnectDetailsSubmitted: true,
        },
      },
      revenueShare: {
        select: {
          id: true,
          purchaseId: true,
          questionId: true,
          answerId: true,
          buyerId: true,
          questionOwnerId: true,
          answerOwnerId: true,
          grossAmount: true,
          questionOwnerAmount: true,
          answerOwnerAmount: true,
          platformFeeAmount: true,
          currency: true,
          status: true,
        },
      },
    },
  });

  return NextResponse.json({
    payouts: payouts.map((payout) => ({
      id: payout.id,
      createdAt: payout.createdAt.toISOString(),
      updatedAt: payout.updatedAt.toISOString(),
      recipientUserId: payout.recipientUserId,
      recipientType: payout.recipientType,
      amount: payout.amount,
      currency: payout.currency,
      stripeChargeId: payout.stripeChargeId,
      transferGroup: payout.transferGroup,
      status: payout.status,
      stripeAccountId: payout.stripeAccountId,
      stripeTransferId: payout.stripeTransferId,
      transferredAt: payout.transferredAt?.toISOString() ?? null,
      failureReason: payout.failureReason,
      recipientUser: {
        id: payout.recipientUser.id,
        email: payout.recipientUser.email,
        username: payout.recipientUser.username,
        stripeAccountId: payout.recipientUser.stripeAccountId,
        stripeConnectPayoutsEnabled:
          payout.recipientUser.stripeConnectPayoutsEnabled,
        stripeConnectDetailsSubmitted:
          payout.recipientUser.stripeConnectDetailsSubmitted,
      },
      revenueShare: payout.revenueShare,
    })),
  });
}

export const dynamic = "force-dynamic";
