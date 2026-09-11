import type Stripe from "stripe";
import prisma from "@/lib/prisma";
import {
  NOTIFICATION_TYPES,
  safeCreateUserNotification,
} from "@/lib/notifications";
import { sendAdminPaymentRiskNotification } from "@/lib/admin-notifications";

type RecoveryReason = "dispute" | "refund";
type LedgerType = "payout" | "best_view_payout";

type RecoveryItem = {
  ledgerType: LedgerType;
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  questionId: string | null;
  transferGroup: string | null;
  directTransferId: string | null;
  batchItemId: string | null;
  batchId: string | null;
  batchAmount: number | null;
  batchStatus: string | null;
  batchTransferId: string | null;
};

const RECOVERABLE_STATUSES = [
  "pending",
  "scheduled",
  "processing",
  "failed",
  "paid",
];

function getRecoveryEventType(reason: RecoveryReason, incidentId: string) {
  return `stripe_${reason}_recovery_completed:${incidentId}`;
}

function getSafeIdempotencyPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

async function loadRecoveryItems(chargeId: string): Promise<RecoveryItem[]> {
  const [payouts, bestViewPayouts] = await Promise.all([
    prisma.payout.findMany({
      where: {
        stripeChargeId: chargeId,
        status: { in: RECOVERABLE_STATUSES },
      },
      select: {
        id: true,
        userId: true,
        amount: true,
        currency: true,
        status: true,
        questionId: true,
        transferGroup: true,
        stripeTransferId: true,
        batchItem: {
          select: {
            id: true,
            batchId: true,
            batch: {
              select: {
                amount: true,
                status: true,
                stripeTransferId: true,
              },
            },
          },
        },
      },
    }),
    prisma.bestViewPayout.findMany({
      where: {
        stripeChargeId: chargeId,
        status: { in: RECOVERABLE_STATUSES },
      },
      select: {
        id: true,
        recipientUserId: true,
        amount: true,
        currency: true,
        status: true,
        transferGroup: true,
        stripeTransferId: true,
        revenueShare: { select: { questionId: true } },
        batchItem: {
          select: {
            id: true,
            batchId: true,
            batch: {
              select: {
                amount: true,
                status: true,
                stripeTransferId: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return [
    ...payouts.map((payout) => ({
      ledgerType: "payout" as const,
      id: payout.id,
      userId: payout.userId,
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status,
      questionId: payout.questionId,
      transferGroup: payout.transferGroup,
      directTransferId: payout.stripeTransferId,
      batchItemId: payout.batchItem?.id ?? null,
      batchId: payout.batchItem?.batchId ?? null,
      batchAmount: payout.batchItem?.batch.amount ?? null,
      batchStatus: payout.batchItem?.batch.status ?? null,
      batchTransferId: payout.batchItem?.batch.stripeTransferId ?? null,
    })),
    ...bestViewPayouts.map((payout) => ({
      ledgerType: "best_view_payout" as const,
      id: payout.id,
      userId: payout.recipientUserId,
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status,
      questionId: payout.revenueShare.questionId,
      transferGroup: payout.transferGroup,
      directTransferId: payout.stripeTransferId,
      batchItemId: payout.batchItem?.id ?? null,
      batchId: payout.batchItem?.batchId ?? null,
      batchAmount: payout.batchItem?.batch.amount ?? null,
      batchStatus: payout.batchItem?.batch.status ?? null,
      batchTransferId: payout.batchItem?.batch.stripeTransferId ?? null,
    })),
  ];
}

async function makePurchasesUnavailable(chargeId: string, reason: RecoveryReason) {
  const purchases = await prisma.purchase.findMany({
    where: { stripeChargeId: chargeId },
    select: { id: true, kind: true, questionId: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.purchase.updateMany({
      where: { stripeChargeId: chargeId },
      data: { status: "REFUNDED" },
    });

    const questionIds = Array.from(
      new Set(
        purchases
          .filter((purchase) => purchase.kind === "question_post")
          .map((purchase) => purchase.questionId)
      )
    );

    for (const questionId of questionIds) {
      const otherPaidPurchase = await tx.purchase.count({
        where: {
          questionId,
          kind: "question_post",
          status: "PAID",
        },
      });
      if (otherPaidPurchase === 0) {
        await tx.question.update({
          where: { id: questionId },
          data: { isPaid: false, isClosed: true },
        });
      }
    }

    await tx.bestViewRevenueShare.updateMany({
      where: { purchase: { stripeChargeId: chargeId } },
      data: { status: reason === "dispute" ? "disputed" : "refunded" },
    });
  });

  return purchases;
}

async function notifyRecovery(
  items: RecoveryItem[],
  reason: RecoveryReason,
  incidentId: string
) {
  const totals = new Map<string, number>();
  for (const item of items) {
    totals.set(item.userId, (totals.get(item.userId) ?? 0) + item.amount);
  }

  for (const [userId, amount] of totals) {
    const reasonLabel = reason === "dispute" ? "カード決済の異議申立て" : "決済の返金";
    await safeCreateUserNotification({
      userId,
      type: NOTIFICATION_TYPES.PAYOUT_RECOVERY,
      message: `${reasonLabel}により、関連する報酬${amount.toLocaleString("ja-JP")}円を保留または回収しました。`,
      url: "/mypage/rewards",
      data: {},
      dedupeKey: `stripe-${reason}-recovery:${incidentId}:${userId}`,
      mandatoryEmail: true,
      context: `stripe_${reason}_payout_recovery`,
    });
  }
}

export async function recoverPayoutsForCharge(input: {
  stripe: Stripe;
  stripeEventId: string;
  incidentId: string;
  chargeId: string;
  reason: RecoveryReason;
  affectedAmount?: number | null;
}) {
  const completedEventType = getRecoveryEventType(input.reason, input.incidentId);
  const alreadyCompleted = await prisma.eventLog.findFirst({
    where: { type: completedEventType },
    select: { id: true },
  });
  if (alreadyCompleted) {
    return { alreadyCompleted: true, recoveredAmount: 0, itemCount: 0 };
  }

  const items = await loadRecoveryItems(input.chargeId);

  for (const item of items) {
    const transferId = item.directTransferId ?? item.batchTransferId;
    if (item.batchStatus === "processing" && !transferId) {
      throw new Error(
        `Stripe recovery is waiting for payout batch processing to finish: ${item.batchId}`
      );
    }
    if (
      (item.status === "paid" || item.status === "processing") &&
      !transferId
    ) {
      throw new Error(
        `Stripe recovery requires manual retry while payout is processing: ${item.ledgerType}:${item.id}`
      );
    }
  }

  const byTransfer = new Map<string, RecoveryItem[]>();
  for (const item of items) {
    const transferId = item.directTransferId ?? item.batchTransferId;
    if (!transferId) continue;
    const group = byTransfer.get(transferId) ?? [];
    group.push(item);
    byTransfer.set(transferId, group);
  }

  const reversals: Array<{
    transferId: string;
    reversalId: string;
    amount: number;
  }> = [];
  for (const [transferId, transferItems] of byTransfer) {
    const amount = transferItems.reduce((sum, item) => sum + item.amount, 0);
    const reversal = await input.stripe.transfers.createReversal(
      transferId,
      {
        amount,
        metadata: {
          source_charge_id: input.chargeId,
          recovery_reason: input.reason,
          stripe_incident_id: input.incidentId,
        },
      },
      {
        idempotencyKey: `kv_recovery_${getSafeIdempotencyPart(input.incidentId)}_${getSafeIdempotencyPart(transferId)}`,
      }
    );
    reversals.push({ transferId, reversalId: reversal.id, amount });
  }

  const heldStatus = `held_${input.reason}`;
  const reversedStatus = `reversed_${input.reason}`;
  const purchases = await makePurchasesUnavailable(
    input.chargeId,
    input.reason
  );

  await prisma.$transaction(async (tx) => {
    const removableByBatch = new Map<
      string,
      { itemIds: string[]; amount: number; originalBatchAmount: number }
    >();

    for (const item of items) {
      const transferId = item.directTransferId ?? item.batchTransferId;
      if (
        !transferId &&
        item.batchId &&
        item.batchItemId &&
        item.batchAmount !== null
      ) {
        const entry = removableByBatch.get(item.batchId) ?? {
          itemIds: [],
          amount: 0,
          originalBatchAmount: item.batchAmount,
        };
        entry.itemIds.push(item.batchItemId);
        entry.amount += item.amount;
        removableByBatch.set(item.batchId, entry);
      }
    }

    for (const [batchId, entry] of removableByBatch) {
      await tx.payoutBatchItem.deleteMany({
        where: { id: { in: entry.itemIds } },
      });
      const nextAmount = Math.max(0, entry.originalBatchAmount - entry.amount);
      await tx.payoutBatch.update({
        where: { id: batchId },
        data: {
          amount: nextAmount,
          ...(nextAmount === 0
            ? { status: "cancelled", failureReason: "対象決済の返金・紛争により振込対象外" }
            : {}),
        },
      });
    }

    for (const item of items) {
      const recoveredFromTransfer = Boolean(
        item.directTransferId ?? item.batchTransferId
      );
      const data = {
        status: recoveredFromTransfer ? reversedStatus : heldStatus,
        failureReason:
          input.reason === "dispute"
            ? "元決済に異議申立てが発生したため報酬を保留・回収"
            : "元決済が返金されたため報酬を保留・回収",
      };
      if (item.ledgerType === "payout") {
        await tx.payout.update({ where: { id: item.id }, data });
      } else {
        await tx.bestViewPayout.update({ where: { id: item.id }, data });
      }
    }

    await tx.eventLog.create({
      data: {
        type: completedEventType,
        payload: {
          stripeEventId: input.stripeEventId,
          incidentId: input.incidentId,
          chargeId: input.chargeId,
          reason: input.reason,
          affectedAmount: input.affectedAmount ?? null,
          recoveredAmount: items.reduce((sum, item) => sum + item.amount, 0),
          items: items.map((item) => ({
            ledgerType: item.ledgerType,
            id: item.id,
            userId: item.userId,
            amount: item.amount,
            previousStatus: item.status,
            batchId: item.batchId,
            transferId: item.directTransferId ?? item.batchTransferId,
          })),
          reversals,
        },
      },
    });
  });

  await notifyRecovery(items, input.reason, input.incidentId);
  await sendAdminPaymentRiskNotification({
    reason: input.reason,
    chargeId: input.chargeId,
    incidentId: input.incidentId,
    recoveredAmount: items.reduce((sum, item) => sum + item.amount, 0),
    itemCount: items.length,
  });

  return {
    alreadyCompleted: false,
    recoveredAmount: items.reduce((sum, item) => sum + item.amount, 0),
    itemCount: items.length,
    purchaseCount: purchases.length,
  };
}

export async function restorePayoutsAfterWonDispute(input: {
  stripeEventId: string;
  disputeId: string;
  chargeId: string;
}) {
  const restoredEventType = `stripe_dispute_recovery_restored:${input.disputeId}`;
  const alreadyRestored = await prisma.eventLog.findFirst({
    where: { type: restoredEventType },
    select: { id: true },
  });
  if (alreadyRestored) return { alreadyRestored: true, restoredAmount: 0 };

  const [payouts, bestViewPayouts] = await Promise.all([
    prisma.payout.findMany({
      where: {
        stripeChargeId: input.chargeId,
        status: { in: ["held_dispute", "reversed_dispute"] },
      },
      select: {
        id: true,
        userId: true,
        questionId: true,
        amount: true,
        currency: true,
        status: true,
        transferGroup: true,
      },
    }),
    prisma.bestViewPayout.findMany({
      where: {
        stripeChargeId: input.chargeId,
        status: { in: ["held_dispute", "reversed_dispute"] },
      },
      select: {
        id: true,
        recipientUserId: true,
        amount: true,
        currency: true,
        status: true,
        transferGroup: true,
        revenueShare: { select: { questionId: true } },
      },
    }),
  ]);

  await prisma.$transaction(async (tx) => {
    await tx.purchase.updateMany({
      where: { stripeChargeId: input.chargeId, status: "REFUNDED" },
      data: { status: "PAID" },
    });

    for (const payout of payouts) {
      if (payout.status === "held_dispute") {
        await tx.payout.update({
          where: { id: payout.id },
          data: { status: "pending", failureReason: null },
        });
      } else {
        await tx.payout.create({
          data: {
            userId: payout.userId,
            questionId: payout.questionId,
            kind: "dispute_reinstatement",
            description: "カード決済の異議申立て解決による報酬再計上",
            amount: payout.amount,
            netAmount: payout.amount,
            currency: payout.currency,
            status: "pending",
            stripeChargeId: input.chargeId,
            transferGroup: payout.transferGroup,
          },
        });
      }
    }

    for (const payout of bestViewPayouts) {
      if (payout.status === "held_dispute") {
        await tx.bestViewPayout.update({
          where: { id: payout.id },
          data: { status: "pending", failureReason: null },
        });
      } else {
        await tx.payout.create({
          data: {
            userId: payout.recipientUserId,
            questionId: payout.revenueShare.questionId,
            kind: "dispute_reinstatement",
            description: "カード決済の異議申立て解決による報酬再計上",
            amount: payout.amount,
            netAmount: payout.amount,
            currency: payout.currency,
            status: "pending",
            stripeChargeId: input.chargeId,
            transferGroup: payout.transferGroup,
          },
        });
      }
    }

    await tx.bestViewRevenueShare.updateMany({
      where: { purchase: { stripeChargeId: input.chargeId } },
      data: { status: "pending" },
    });

    const questionPostPurchases = await tx.purchase.findMany({
      where: {
        stripeChargeId: input.chargeId,
        kind: "question_post",
        status: "PAID",
      },
      select: { questionId: true },
    });
    for (const purchase of questionPostPurchases) {
      const question = await tx.question.findUnique({
        where: { id: purchase.questionId },
        select: {
          bestAnswerId: true,
          rewardStoppedAt: true,
          cancellationRequests: {
            where: { status: "approved" },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (question && question.cancellationRequests.length === 0) {
        await tx.question.update({
          where: { id: purchase.questionId },
          data: {
            isPaid: true,
            isClosed: Boolean(question.bestAnswerId || question.rewardStoppedAt),
          },
        });
      }
    }

    await tx.eventLog.create({
      data: {
        type: restoredEventType,
        payload: {
          stripeEventId: input.stripeEventId,
          disputeId: input.disputeId,
          chargeId: input.chargeId,
          restoredAmount:
            payouts.reduce((sum, payout) => sum + payout.amount, 0) +
            bestViewPayouts.reduce((sum, payout) => sum + payout.amount, 0),
        },
      },
    });
  });

  const totals = new Map<string, number>();
  for (const payout of payouts) {
    totals.set(payout.userId, (totals.get(payout.userId) ?? 0) + payout.amount);
  }
  for (const payout of bestViewPayouts) {
    totals.set(
      payout.recipientUserId,
      (totals.get(payout.recipientUserId) ?? 0) + payout.amount
    );
  }
  for (const [userId, amount] of totals) {
    await safeCreateUserNotification({
      userId,
      type: NOTIFICATION_TYPES.PAYOUT_RECOVERY,
      message: `カード決済の異議申立てが解決したため、保留・回収していた報酬${amount.toLocaleString("ja-JP")}円を再計上しました。`,
      url: "/mypage/rewards",
      data: {},
      dedupeKey: `stripe-dispute-restored:${input.disputeId}:${userId}`,
      mandatoryEmail: true,
      context: "stripe_dispute_payout_restored",
    });
  }

  return {
    alreadyRestored: false,
    restoredAmount:
      payouts.reduce((sum, payout) => sum + payout.amount, 0) +
      bestViewPayouts.reduce((sum, payout) => sum + payout.amount, 0),
  };
}

export async function finalizeLostDispute(input: {
  stripeEventId: string;
  disputeId: string;
  chargeId: string;
}) {
  const eventType = `stripe_dispute_lost:${input.disputeId}`;
  const existing = await prisma.eventLog.findFirst({
    where: { type: eventType },
    select: { id: true },
  });
  if (existing) return;

  await prisma.$transaction(async (tx) => {
    await tx.payout.updateMany({
      where: {
        stripeChargeId: input.chargeId,
        status: "held_dispute",
      },
      data: {
        status: "reversed_dispute",
        failureReason: "カード決済の異議申立てが購入者側有利で確定",
      },
    });
    await tx.bestViewPayout.updateMany({
      where: {
        stripeChargeId: input.chargeId,
        status: "held_dispute",
      },
      data: {
        status: "reversed_dispute",
        failureReason: "カード決済の異議申立てが購入者側有利で確定",
      },
    });
    await tx.eventLog.create({
      data: {
        type: eventType,
        payload: {
          stripeEventId: input.stripeEventId,
          disputeId: input.disputeId,
          chargeId: input.chargeId,
        },
      },
    });
  });
}
