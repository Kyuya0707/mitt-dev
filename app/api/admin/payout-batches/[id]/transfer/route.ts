import { NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getCurrentUserAdminStatus } from "@/lib/admin";
import { getSafeErrorMessage } from "@/lib/safe-error";
import {
  NOTIFICATION_TYPES,
  safeCreateUserNotification,
} from "@/lib/notifications";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

function transferErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("balance")) return "プラットフォーム残高が不足しています";
  if (message.includes("destination") || message.includes("account")) {
    return "Stripe受取設定を確認してください";
  }
  return "Stripe Transferの実行に失敗しました";
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: adminUser, canManageAccounting } = await getCurrentUserAdminStatus();
  if (!adminUser) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }
  if (!canManageAccounting) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const batch = await prisma.payoutBatch.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          stripeAccountId: true,
          stripeConnectPayoutsEnabled: true,
          stripeConnectDetailsSubmitted: true,
        },
      },
      items: { select: { payoutId: true, bestViewPayoutId: true } },
    },
  });
  if (!batch) {
    return NextResponse.json({ error: "振込予定が見つかりません" }, { status: 404 });
  }
  if (batch.stripeTransferId || batch.status === "paid") {
    return NextResponse.json({ error: "すでに振込済みです" }, { status: 409 });
  }
  if (batch.status === "processing") {
    return NextResponse.json({ error: "現在処理中です" }, { status: 409 });
  }
  if (batch.amount < 5000) {
    return NextResponse.json({ error: "振込最低額5,000円を下回っています" }, { status: 400 });
  }

  const destination = batch.stripeAccountId ?? batch.user.stripeAccountId;
  if (
    !destination ||
    !batch.user.stripeConnectPayoutsEnabled ||
    !batch.user.stripeConnectDetailsSubmitted
  ) {
    return NextResponse.json({ error: "ユーザーのStripe受取設定が未完了です" }, { status: 400 });
  }

  const locked = await prisma.payoutBatch.updateMany({
    where: { id, status: { in: ["scheduled", "failed"] }, stripeTransferId: null },
    data: { status: "processing", failureReason: null },
  });
  if (locked.count === 0) {
    return NextResponse.json({ error: "すでに処理が開始されています" }, { status: 409 });
  }

  try {
    const transfer = await getStripe().transfers.create(
      {
        amount: batch.amount,
        currency: batch.currency,
        destination,
        metadata: {
          payoutBatchId: batch.id,
          periodKey: batch.periodKey,
          userId: batch.userId,
          itemCount: String(batch.items.length),
        },
      },
      { idempotencyKey: `monthly_payout_batch_${batch.id}` }
    );
    const transferredAt = new Date();
    const payoutIds = batch.items.flatMap((item) => item.payoutId ? [item.payoutId] : []);
    const bestViewPayoutIds = batch.items.flatMap((item) =>
      item.bestViewPayoutId ? [item.bestViewPayoutId] : []
    );

    await prisma.$transaction(async (tx) => {
      await tx.payoutBatch.update({
        where: { id: batch.id },
        data: {
          status: "paid",
          stripeAccountId: destination,
          stripeTransferId: transfer.id,
          transferredAt,
          failureReason: null,
        },
      });
      if (payoutIds.length > 0) {
        await tx.payout.updateMany({
          where: { id: { in: payoutIds } },
          data: { status: "paid", transferredAt, stripeAccountId: destination, failureReason: null },
        });
      }
      if (bestViewPayoutIds.length > 0) {
        await tx.bestViewPayout.updateMany({
          where: { id: { in: bestViewPayoutIds } },
          data: { status: "paid", transferredAt, stripeAccountId: destination, failureReason: null },
        });
      }
      await tx.eventLog.create({
        data: {
          type: "monthly_payout_transfer_completed",
          payload: {
            batchId: batch.id,
            stripeTransferId: transfer.id,
            amount: batch.amount,
            administeredById: adminUser.id,
          },
        },
      });
    });

    await safeCreateUserNotification({
      userId: batch.userId,
      type: NOTIFICATION_TYPES.PAYOUT_COMPLETED,
      message: `${batch.periodKey}締めの報酬${batch.amount.toLocaleString("ja-JP")}円の振込が完了しました。`,
      url: "/mypage/rewards",
      data: {},
      dedupeKey: `payout-batch-completed:${batch.id}`,
      mandatoryEmail: true,
      context: "monthly_payout_completed",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const failureReason = transferErrorMessage(error);
    await prisma.$transaction([
      prisma.payoutBatch.update({
        where: { id: batch.id },
        data: { status: "failed", failureReason },
      }),
      prisma.eventLog.create({
        data: {
          type: "monthly_payout_transfer_failed",
          payload: { batchId: batch.id, failureReason, administeredById: adminUser.id },
        },
      }),
    ]);
    await safeCreateUserNotification({
      userId: batch.userId,
      type: NOTIFICATION_TYPES.PAYOUT_FAILED,
      message: `${batch.periodKey}締めの報酬振込に失敗しました。KnowValueのStripe受取設定を確認してください。`,
      url: "/mypage",
      data: {},
      dedupeKey: `payout-batch-failed:${batch.id}:${Date.now()}`,
      mandatoryEmail: true,
      context: "monthly_payout_failed",
    });
    console.error("Monthly payout transfer error:", getSafeErrorMessage(error));
    return NextResponse.json({ error: failureReason }, { status: 500 });
  }
}
