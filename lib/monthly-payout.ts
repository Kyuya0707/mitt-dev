import prisma from "@/lib/prisma";
import {
  NOTIFICATION_TYPES,
  safeCreateUserNotification,
} from "@/lib/notifications";
import Stripe from "stripe";

const MINIMUM_PAYOUT_AMOUNT = 5000;

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

function previousMonthPeriodKey(now: Date) {
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function createMonthlyPayoutBatches(now = new Date()) {
  if (now.getUTCDate() !== 1) {
    return { skipped: true, createdCount: 0 };
  }

  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodKey = previousMonthPeriodKey(now);
  const [payouts, bestViewPayouts] = await Promise.all([
    prisma.payout.findMany({
      where: {
        status: "pending",
        createdAt: { lt: cutoff },
        batchItem: null,
      },
      select: { id: true, userId: true, amount: true },
    }),
    prisma.bestViewPayout.findMany({
      where: {
        status: "pending",
        createdAt: { lt: cutoff },
        batchItem: null,
      },
      select: { id: true, recipientUserId: true, amount: true },
    }),
  ]);

  const byUser = new Map<
    string,
    { payouts: typeof payouts; bestViewPayouts: typeof bestViewPayouts; total: number }
  >();
  for (const payout of payouts) {
    const entry = byUser.get(payout.userId) ?? { payouts: [], bestViewPayouts: [], total: 0 };
    entry.payouts.push(payout);
    entry.total += payout.amount;
    byUser.set(payout.userId, entry);
  }
  for (const payout of bestViewPayouts) {
    const entry = byUser.get(payout.recipientUserId) ?? { payouts: [], bestViewPayouts: [], total: 0 };
    entry.bestViewPayouts.push(payout);
    entry.total += payout.amount;
    byUser.set(payout.recipientUserId, entry);
  }

  let createdCount = 0;
  for (const [userId, entry] of byUser) {
    if (entry.total < MINIMUM_PAYOUT_AMOUNT) continue;
    const existing = await prisma.payoutBatch.findUnique({
      where: { userId_periodKey: { userId, periodKey } },
      select: { id: true },
    });
    if (existing) continue;

    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.payoutBatch.create({
        data: {
          userId,
          periodKey,
          amount: entry.total,
          items: {
            create: [
              ...entry.payouts.map((payout) => ({
                payoutId: payout.id,
                amount: payout.amount,
              })),
              ...entry.bestViewPayouts.map((payout) => ({
                bestViewPayoutId: payout.id,
                amount: payout.amount,
              })),
            ],
          },
        },
      });
      if (entry.payouts.length > 0) {
        await tx.payout.updateMany({
          where: { id: { in: entry.payouts.map((payout) => payout.id) } },
          data: { status: "scheduled" },
        });
      }
      if (entry.bestViewPayouts.length > 0) {
        await tx.bestViewPayout.updateMany({
          where: { id: { in: entry.bestViewPayouts.map((payout) => payout.id) } },
          data: { status: "scheduled" },
        });
      }
      await tx.eventLog.create({
        data: {
          type: "monthly_payout_batch_created",
          payload: {
            batchId: created.id,
            userId,
            periodKey,
            amount: entry.total,
            itemCount: entry.payouts.length + entry.bestViewPayouts.length,
          },
        },
      });
      return created;
    });

    await safeCreateUserNotification({
      userId,
      type: NOTIFICATION_TYPES.PAYOUT_TRANSFER_SCHEDULED,
      message: `${periodKey}締めの報酬${entry.total.toLocaleString("ja-JP")}円が振込予定になりました。`,
      url: "/mypage/rewards",
      data: {},
      dedupeKey: `monthly-payout-scheduled:${batch.id}`,
      mandatoryEmail: true,
      context: "monthly_payout_scheduled",
    });
    createdCount += 1;
  }

  return { skipped: false, periodKey, createdCount };
}

export async function processScheduledMonthlyPayoutBatches() {
  const batches = await prisma.payoutBatch.findMany({
    where: { status: "scheduled", stripeTransferId: null },
    take: 200,
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
  const stripe = getStripe();
  let completedCount = 0;
  const errors: Array<{ batchId: string; message: string }> = [];
  for (const batch of batches) {
    const destination = batch.stripeAccountId ?? batch.user.stripeAccountId;
    if (
      !destination ||
      !batch.user.stripeConnectPayoutsEnabled ||
      !batch.user.stripeConnectDetailsSubmitted
    ) {
      const message = "Stripe受取設定が未完了です";
      await prisma.payoutBatch.update({ where: { id: batch.id }, data: { status: "failed", failureReason: message } });
      errors.push({ batchId: batch.id, message });
      await safeCreateUserNotification({
        userId: batch.userId,
        type: NOTIFICATION_TYPES.PAYOUT_FAILED,
        message: `${batch.periodKey}締めの報酬振込を実行できませんでした。KnowValueのStripe受取設定を確認してください。`,
        url: "/mypage",
        data: {},
        dedupeKey: `payout-batch-failed:${batch.id}:connect`,
        mandatoryEmail: true,
        context: "monthly_payout_failed_connect",
      });
      continue;
    }
    const locked = await prisma.payoutBatch.updateMany({
      where: { id: batch.id, status: "scheduled", stripeTransferId: null },
      data: { status: "processing", failureReason: null },
    });
    if (locked.count === 0) continue;
    try {
      const transfer = await stripe.transfers.create(
        {
          amount: batch.amount,
          currency: batch.currency,
          destination,
          metadata: {
            payoutBatchId: batch.id,
            periodKey: batch.periodKey,
            userId: batch.userId,
          },
        },
        { idempotencyKey: `monthly_payout_batch_${batch.id}` }
      );
      const transferredAt = new Date();
      const payoutIds = batch.items.flatMap((item) => item.payoutId ? [item.payoutId] : []);
      const bestViewPayoutIds = batch.items.flatMap((item) => item.bestViewPayoutId ? [item.bestViewPayoutId] : []);
      await prisma.$transaction(async (tx) => {
        await tx.payoutBatch.update({
          where: { id: batch.id },
          data: { status: "paid", stripeAccountId: destination, stripeTransferId: transfer.id, transferredAt },
        });
        if (payoutIds.length) {
          await tx.payout.updateMany({ where: { id: { in: payoutIds } }, data: { status: "paid", stripeAccountId: destination, transferredAt } });
        }
        if (bestViewPayoutIds.length) {
          await tx.bestViewPayout.updateMany({ where: { id: { in: bestViewPayoutIds } }, data: { status: "paid", stripeAccountId: destination, transferredAt } });
        }
        await tx.eventLog.create({
          data: { type: "monthly_payout_transfer_completed", payload: { batchId: batch.id, stripeTransferId: transfer.id, amount: batch.amount, administeredById: "system" } },
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
      completedCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe Transfer failed";
      await prisma.payoutBatch.update({ where: { id: batch.id }, data: { status: "failed", failureReason: message.slice(0, 500) } });
      await prisma.eventLog.create({
        data: { type: "monthly_payout_transfer_failed", payload: { batchId: batch.id, message } },
      });
      errors.push({ batchId: batch.id, message });
      await safeCreateUserNotification({
        userId: batch.userId,
        type: NOTIFICATION_TYPES.PAYOUT_FAILED,
        message: `${batch.periodKey}締めの報酬振込に失敗しました。KnowValueのStripe受取設定を確認してください。`,
        url: "/mypage",
        data: {},
        dedupeKey: `payout-batch-failed:${batch.id}:transfer`,
        mandatoryEmail: true,
        context: "monthly_payout_failed",
      });
    }
  }
  return { checkedCount: batches.length, completedCount, errors };
}
