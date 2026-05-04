import { NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getCurrentUserAdminStatus } from "@/lib/admin";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  return new Stripe(key);
}

function mapTransferErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Stripe Transfer の実行に失敗しました";
  const normalized = message.toLowerCase();

  if (normalized.includes("balance")) {
    return "プラットフォーム残高が不足しています";
  }

  if (
    normalized.includes("destination") ||
    normalized.includes("connected account") ||
    normalized.includes("account invalid")
  ) {
    return "送金先の受取設定が無効です";
  }

  if (
    normalized.includes("payouts_enabled") ||
    normalized.includes("details_submitted") ||
    normalized.includes("requirements")
  ) {
    return "受取設定が未完了です";
  }

  return "Stripe Transfer の実行に失敗しました";
}

export async function POST(
  _req: Request,
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

  const payout = await prisma.bestViewPayout.findUnique({
    where: { id },
    include: {
      recipientUser: {
        select: {
          id: true,
          email: true,
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
        },
      },
    },
  });

  if (!payout) {
    return NextResponse.json(
      { error: "BEST閲覧料 Payout が見つかりません" },
      { status: 404 }
    );
  }

  if (payout.stripeTransferId) {
    return NextResponse.json(
      { error: "この BEST閲覧料 Payout はすでに送金済みです" },
      { status: 400 }
    );
  }

  if (payout.status === "processing") {
    return NextResponse.json(
      { error: "この BEST閲覧料 Payout は現在処理中です" },
      { status: 400 }
    );
  }

  if (payout.status !== "pending" && payout.status !== "failed") {
    return NextResponse.json(
      { error: "未送金または失敗状態の Payout のみ送金できます" },
      { status: 400 }
    );
  }

  if (payout.amount <= 0) {
    return NextResponse.json({ error: "送金額が不正です" }, { status: 400 });
  }

  if (!payout.recipientUser) {
    return NextResponse.json({ error: "受取ユーザーが存在しません" }, { status: 400 });
  }

  const destinationStripeAccountId =
    payout.stripeAccountId ?? payout.recipientUser.stripeAccountId;

  if (!destinationStripeAccountId) {
    return NextResponse.json(
      { error: "受取設定が未完了です" },
      { status: 400 }
    );
  }

  if (!payout.recipientUser.stripeConnectPayoutsEnabled) {
    return NextResponse.json(
      { error: "受取設定で payouts_enabled が未完了です" },
      { status: 400 }
    );
  }

  if (!payout.recipientUser.stripeConnectDetailsSubmitted) {
    return NextResponse.json(
      { error: "受取設定で本人確認が未完了です" },
      { status: 400 }
    );
  }

  const locked = await prisma.bestViewPayout.updateMany({
    where: {
      id: payout.id,
      status: {
        in: ["pending", "failed"],
      },
      stripeTransferId: null,
    },
    data: {
      status: "processing",
      failureReason: null,
    },
  });

  if (locked.count === 0) {
    return NextResponse.json(
      { error: "この BEST閲覧料 Payout はすでに処理中または送金済みです" },
      { status: 409 }
    );
  }

  try {
    const stripe = getStripe();
    const transfer = await stripe.transfers.create({
      amount: payout.amount,
      currency: payout.currency || "jpy",
      destination: destinationStripeAccountId,
      metadata: {
        bestViewPayoutId: payout.id,
        revenueShareId: payout.revenueShareId,
        recipientUserId: payout.recipientUserId,
        recipientType: payout.recipientType,
        purchaseId: payout.revenueShare.purchaseId,
        questionId: payout.revenueShare.questionId,
        answerId: payout.revenueShare.answerId,
      },
    });

    const updated = await prisma.bestViewPayout.update({
      where: { id: payout.id },
      data: {
        status: "paid",
        stripeTransferId: transfer.id,
        transferredAt: new Date(),
        stripeAccountId: destinationStripeAccountId,
        failureReason: null,
      },
      select: {
        id: true,
        status: true,
        stripeTransferId: true,
        transferredAt: true,
        stripeAccountId: true,
      },
    });

    return NextResponse.json({
      payout: {
        ...updated,
        transferredAt: updated.transferredAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    const failureReason = mapTransferErrorMessage(error);

    await prisma.bestViewPayout.update({
      where: { id: payout.id },
      data: {
        status: "failed",
        failureReason,
      },
    });

    console.error("BestViewPayout transfer error:", error);
    return NextResponse.json({ error: failureReason }, { status: 500 });
  }
}
