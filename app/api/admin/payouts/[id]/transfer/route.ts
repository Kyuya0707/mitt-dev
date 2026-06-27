import { NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getCurrentUserAdminStatus } from "@/lib/admin";
import { buildQuestionTransferGroup } from "@/lib/stripe-connect-transfer";
import { getSafeErrorMessage } from "@/lib/safe-error";

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

  const payout = await prisma.payout.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          stripeAccountId: true,
          stripeConnectPayoutsEnabled: true,
          stripeConnectDetailsSubmitted: true,
        },
      },
      answer: {
        select: {
          id: true,
          questionId: true,
        },
      },
      question: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!payout) {
    return NextResponse.json({ error: "Payout が見つかりません" }, { status: 404 });
  }

  if (payout.stripeTransferId) {
    return NextResponse.json(
      { error: "この Payout はすでに送金済みです" },
      { status: 400 }
    );
  }

  if (payout.status === "processing") {
    return NextResponse.json(
      { error: "この Payout は現在処理中です" },
      { status: 400 }
    );
  }

  if (payout.status !== "pending" && payout.status !== "failed") {
    return NextResponse.json(
      { error: "未送金または失敗状態の Payout のみ送金できます" },
      { status: 400 }
    );
  }

  const transferAmount = payout.netAmount ?? payout.amount;

  if (transferAmount <= 0) {
    return NextResponse.json({ error: "送金額が不正です" }, { status: 400 });
  }

  if (!payout.user) {
    return NextResponse.json({ error: "回答者ユーザーが存在しません" }, { status: 400 });
  }

  const destinationStripeAccountId =
    payout.stripeAccountId ?? payout.user.stripeAccountId;

  if (!destinationStripeAccountId) {
    return NextResponse.json(
      { error: "回答者の受取設定が未完了です" },
      { status: 400 }
    );
  }

  if (!payout.user.stripeConnectPayoutsEnabled) {
    return NextResponse.json(
      { error: "回答者の受取設定で payouts_enabled が未完了です" },
      { status: 400 }
    );
  }

  if (!payout.user.stripeConnectDetailsSubmitted) {
    return NextResponse.json(
      { error: "回答者の受取設定で本人確認が未完了です" },
      { status: 400 }
    );
  }

  const locked = await prisma.payout.updateMany({
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
      { error: "この Payout はすでに処理中または送金済みです" },
      { status: 409 }
    );
  }

  try {
    const stripe = getStripe();
    const questionId = payout.questionId ?? payout.question?.id ?? payout.answer?.questionId;
    const transferGroup =
      payout.transferGroup ?? (questionId ? buildQuestionTransferGroup(questionId) : null);

    const transfer = await stripe.transfers.create({
      amount: transferAmount,
      currency: payout.currency || "jpy",
      destination: destinationStripeAccountId,
      ...(transferGroup ? { transfer_group: transferGroup } : {}),
      ...(payout.stripeChargeId ? { source_transaction: payout.stripeChargeId } : {}),
      metadata: {
        payoutId: payout.id,
        payoutKind: payout.kind,
        payoutDescription: payout.description ?? "",
        userId: payout.userId,
        questionId: questionId ?? "",
        answerId: payout.answerId ?? "",
        negotiationId: payout.negotiationId ?? "",
      },
    });

    const updated = await prisma.payout.update({
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

    await prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: "failed",
        failureReason,
      },
    });

    console.error("Payout transfer error:", {
      message: getSafeErrorMessage(error),
    });
    return NextResponse.json(
      { error: failureReason },
      { status: 500 }
    );
  }
}
