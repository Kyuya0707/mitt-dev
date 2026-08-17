import Stripe from "stripe";
import prisma from "@/lib/prisma";
import {
  NOTIFICATION_TYPES,
  safeCreateUserNotification,
} from "@/lib/notifications";
import { getSafeErrorMessage } from "@/lib/safe-error";

const DAY_MS = 24 * 60 * 60 * 1000;

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key);
}

function elapsedDays(from: Date, now: Date) {
  return Math.floor((now.getTime() - from.getTime()) / DAY_MS);
}

function getBestReminderDay(daysAfterDeadline: number) {
  if ([0, 3, 7].includes(daysAfterDeadline)) {
    return daysAfterDeadline;
  }
  if (daysAfterDeadline >= 37 && (daysAfterDeadline - 7) % 30 === 0) {
    return daysAfterDeadline;
  }
  return null;
}

export async function sendScheduledQuestionReminders(now = new Date()) {
  const [bestCandidates, rewardCandidates] = await Promise.all([
    prisma.question.findMany({
      where: {
        isPaid: true,
        bestAnswerId: null,
        answerDeadline: { lte: now },
        cancellationRequests: { none: { status: "approved" } },
      },
      select: {
        id: true,
        title: true,
        userId: true,
        answerDeadline: true,
      },
      take: 1000,
    }),
    prisma.question.findMany({
      where: {
        isPaid: true,
        isClosed: false,
        bestAnswerId: null,
        rewardPeriodStartedAt: { not: null },
        rewardExpiresAt: { gt: now },
        cancellationRequests: { none: { status: "approved" } },
      },
      select: {
        id: true,
        title: true,
        userId: true,
        rewardPeriodStartedAt: true,
      },
      take: 1000,
    }),
  ]);

  let bestReminderCount = 0;
  for (const question of bestCandidates) {
    if (!question.userId || !question.answerDeadline) {
      continue;
    }
    const dueDay = getBestReminderDay(elapsedDays(question.answerDeadline, now));
    if (dueDay === null) {
      continue;
    }

    await safeCreateUserNotification({
      userId: question.userId,
      type: NOTIFICATION_TYPES.BEST_SELECTION_REMINDER,
      message: `「${question.title}」のBEST回答を選んでください。良い回答がない場合は、回答待ちまたはキャンセル申請を利用できます。`,
      url: `/questions/${question.id}`,
      data: { questionId: question.id, reminderKey: `deadline-${dueDay}` },
      dedupeKey: `best-reminder:${question.id}:${dueDay}`,
      context: "best_selection_reminder",
    });
    bestReminderCount += 1;
  }

  let rewardReminderCount = 0;
  for (const question of rewardCandidates) {
    if (!question.userId || !question.rewardPeriodStartedAt) {
      continue;
    }
    const dueDay = elapsedDays(question.rewardPeriodStartedAt, now);
    if (![75, 85, 89].includes(dueDay)) {
      continue;
    }

    await safeCreateUserNotification({
      userId: question.userId,
      type: NOTIFICATION_TYPES.REWARD_PERIOD_REMINDER,
      message: `「${question.title}」の質問報酬期間は${90 - dueDay}日後に終了します。BEST回答を選ぶか、引き続き回答をお待ちください。`,
      url: `/questions/${question.id}`,
      data: { questionId: question.id, reminderKey: `reward-${dueDay}` },
      dedupeKey: `reward-reminder:${question.id}:${dueDay}`,
      context: "reward_period_reminder",
    });
    rewardReminderCount += 1;
  }

  return { bestReminderCount, rewardReminderCount };
}

async function stopExpiredQuestionReward(question: {
  id: string;
  title: string;
  userId: string | null;
  rewardAmount: number;
  rewardExpiresAt: Date | null;
  purchases: Array<{
    id: string;
    stripeSessionId: string | null;
  }>;
}) {
  const purchase = question.purchases[0];
  if (!question.userId || !question.rewardExpiresAt || !purchase?.stripeSessionId) {
    throw new Error("expired reward purchase not found");
  }
  const rewardExpiresAt = question.rewardExpiresAt;

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(purchase.stripeSessionId, {
    expand: ["payment_intent"],
  });
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!paymentIntentId) {
    throw new Error("expired reward payment intent not found");
  }

  const refund = await stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      amount: question.rewardAmount,
      metadata: {
        kind: "question_reward_expiry",
        questionId: question.id,
        purchaseId: purchase.id,
      },
    },
    { idempotencyKey: `question_reward_expiry_${question.id}_${purchase.id}` }
  );

  const stoppedAt = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const stopped = await tx.question.updateMany({
      where: {
        id: question.id,
        bestAnswerId: null,
        isClosed: false,
        rewardExpiresAt: { lte: stoppedAt },
      },
      data: { isClosed: true, rewardStoppedAt: stoppedAt },
    });
    if (stopped.count === 0) {
      return false;
    }

    await tx.purchase.update({
      where: { id: purchase.id },
      data: { status: "REFUNDED" },
    });
    await tx.eventLog.create({
      data: {
        type: "question_reward_period_expired",
        payload: {
          questionId: question.id,
          purchaseId: purchase.id,
          stripeRefundId: refund.id,
          refundedAmount: question.rewardAmount,
          rewardExpiresAt: rewardExpiresAt.toISOString(),
        },
      },
    });
    return true;
  });

  if (!updated) {
    return false;
  }

  await safeCreateUserNotification({
    userId: question.userId,
    type: NOTIFICATION_TYPES.REWARD_PERIOD_EXPIRED,
    message: `「${question.title}」は90日間の報酬期間が終了したため、質問報酬${question.rewardAmount.toLocaleString("ja-JP")}円を返金しました。10%の利用料は返金されません。再決済すると回答受付を再開できます。`,
    url: `/questions/${question.id}`,
    data: { questionId: question.id, reminderKey: "reward-expired" },
    dedupeKey: `reward-expired:${question.id}:${purchase.id}`,
    mandatoryEmail: true,
    context: "reward_period_expired",
  });

  return true;
}

export async function stopExpiredQuestionRewards(now = new Date()) {
  const expiredQuestions = await prisma.question.findMany({
    where: {
      isPaid: true,
      isClosed: false,
      bestAnswerId: null,
      rewardExpiresAt: { lte: now },
      cancellationRequests: { none: { status: "approved" } },
    },
    select: {
      id: true,
      title: true,
      userId: true,
      rewardAmount: true,
      rewardExpiresAt: true,
      purchases: {
        where: { kind: "question_post", status: "PAID" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, stripeSessionId: true },
      },
    },
    take: 200,
  });

  let stoppedCount = 0;
  const errors: Array<{ questionId: string; message: string }> = [];
  for (const question of expiredQuestions) {
    try {
      if (await stopExpiredQuestionReward(question)) {
        stoppedCount += 1;
      }
    } catch (error) {
      errors.push({
        questionId: question.id,
        message: getSafeErrorMessage(error),
      });
    }
  }

  return { checkedCount: expiredQuestions.length, stoppedCount, errors };
}
