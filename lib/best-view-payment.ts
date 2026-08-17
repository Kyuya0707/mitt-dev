import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { ensurePrismaUser } from "@/lib/ensure-prisma-user";
import { sendAdminPayoutNotification } from "@/lib/admin-notifications";
import {
  buildBestViewTransferGroup,
  resolveCheckoutChargeId,
} from "@/lib/stripe-connect-transfer";
import { getSafeErrorMessage } from "@/lib/safe-error";
import { getBestViewRevenueBreakdown } from "@/lib/best-view-breakdown";
import {
  NOTIFICATION_TYPES,
  safeCreateUserNotification,
} from "@/lib/notifications";

type VerifyBestViewCheckoutSessionResult =
  | {
      ok: true;
      session: Stripe.Checkout.Session;
      questionId: string;
      answerId: string;
      buyerId: string;
      isPaid: boolean;
      alreadyPurchased: boolean;
      createdPurchase: boolean;
    }
  | {
      ok: false;
      reason:
        | "missing_session_id"
        | "stripe_not_configured"
        | "session_not_found"
        | "missing_metadata"
        | "session_mismatch"
        | "invalid_kind"
        | "purchase_subject_not_found"
        | "stripe_error";
    };

type VerifyBestViewCheckoutSessionInput =
  | {
      questionId: string;
      sessionId?: string | null;
      session?: never;
    }
  | {
      questionId?: string;
      sessionId?: never;
      session: Stripe.Checkout.Session;
    };

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  return new Stripe(key);
}

async function ensureBestViewRevenueShare(params: {
  purchaseId: string;
  questionId: string;
  answerId: string;
  buyerId: string;
  questionOwnerId: string;
  answerOwnerId: string;
  grossAmount: number;
  currency: string;
  stripeChargeId?: string | null;
  transferGroup?: string | null;
}) {
  const existing = await prisma.bestViewRevenueShare.findUnique({
    where: { purchaseId: params.purchaseId },
    select: {
      id: true,
      questionOwnerId: true,
      answerOwnerId: true,
      questionOwnerAmount: true,
      answerOwnerAmount: true,
      currency: true,
    },
  });

  if (existing) {
    await ensureBestViewPayouts({
      revenueShareId: existing.id,
      questionId: params.questionId,
      answerId: params.answerId,
      questionOwnerId: existing.questionOwnerId,
      questionOwnerAmount: existing.questionOwnerAmount,
      answerOwnerId: existing.answerOwnerId,
      answerOwnerAmount: existing.answerOwnerAmount,
      currency: existing.currency,
      stripeChargeId: params.stripeChargeId ?? null,
      transferGroup: params.transferGroup ?? null,
    });
    return existing;
  }

  const breakdown = getBestViewRevenueBreakdown(params.grossAmount);

  const revenueShare = await prisma.bestViewRevenueShare.create({
    data: {
      purchaseId: params.purchaseId,
      questionId: params.questionId,
      answerId: params.answerId,
      buyerId: params.buyerId,
      questionOwnerId: params.questionOwnerId,
      answerOwnerId: params.answerOwnerId,
      grossAmount: params.grossAmount,
      questionOwnerAmount: breakdown.questionOwnerAmount,
      answerOwnerAmount: breakdown.answerOwnerAmount,
      platformFeeAmount: breakdown.platformFeeAmount,
      currency: params.currency,
      status: "pending",
    },
    select: {
      id: true,
      questionOwnerId: true,
      answerOwnerId: true,
      questionOwnerAmount: true,
      answerOwnerAmount: true,
      currency: true,
    },
  });

  await ensureBestViewPayouts({
    revenueShareId: revenueShare.id,
    questionId: params.questionId,
    answerId: params.answerId,
    questionOwnerId: revenueShare.questionOwnerId,
    questionOwnerAmount: revenueShare.questionOwnerAmount,
    answerOwnerId: revenueShare.answerOwnerId,
    answerOwnerAmount: revenueShare.answerOwnerAmount,
    currency: revenueShare.currency,
    stripeChargeId: params.stripeChargeId ?? null,
    transferGroup: params.transferGroup ?? null,
  });

  return revenueShare;
}

async function ensureBestViewPayouts(params: {
  revenueShareId: string;
  questionId: string;
  answerId: string;
  questionOwnerId: string;
  questionOwnerAmount: number;
  answerOwnerId: string;
  answerOwnerAmount: number;
  currency: string;
  stripeChargeId?: string | null;
  transferGroup?: string | null;
}) {
  const recipients = [
    {
      recipientType: "question_owner",
      recipientUserId: params.questionOwnerId,
      amount: params.questionOwnerAmount,
    },
    {
      recipientType: "answer_owner",
      recipientUserId: params.answerOwnerId,
      amount: params.answerOwnerAmount,
    },
  ] as const;

  for (const recipient of recipients) {
    const existingPayout = await prisma.bestViewPayout.findUnique({
      where: {
        revenueShareId_recipientType: {
          revenueShareId: params.revenueShareId,
          recipientType: recipient.recipientType,
        },
      },
      select: {
        id: true,
        stripeChargeId: true,
        transferGroup: true,
      },
    });

    if (existingPayout) {
      if (
        (params.stripeChargeId && !existingPayout.stripeChargeId) ||
        (params.transferGroup && !existingPayout.transferGroup)
      ) {
        await prisma.bestViewPayout.update({
          where: { id: existingPayout.id },
          data: {
            ...(params.stripeChargeId && !existingPayout.stripeChargeId
              ? { stripeChargeId: params.stripeChargeId }
              : {}),
            ...(params.transferGroup && !existingPayout.transferGroup
              ? { transferGroup: params.transferGroup }
              : {}),
          },
        });
      }
      continue;
    }

    const createdPayout = await prisma.bestViewPayout.create({
      data: {
        revenueShareId: params.revenueShareId,
        recipientUserId: recipient.recipientUserId,
        recipientType: recipient.recipientType,
        amount: recipient.amount,
        currency: params.currency,
        status: "pending",
        stripeChargeId: params.stripeChargeId ?? null,
        transferGroup: params.transferGroup ?? null,
      },
      select: {
        amount: true,
        recipientUser: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    await sendAdminPayoutNotification({
      payoutType: "best_view",
      amount: createdPayout.amount,
      recipientName: createdPayout.recipientUser.username,
      recipientEmail: createdPayout.recipientUser.email,
      questionId: params.questionId,
      answerId: params.answerId,
      adminPath: "/admin/best-view-payouts",
    });
    await safeCreateUserNotification({
      userId: recipient.recipientUserId,
      type: NOTIFICATION_TYPES.PAYOUT_SCHEDULED,
      message: `BEST閲覧料の分配${createdPayout.amount.toLocaleString("ja-JP")}円をサービス内残高へ反映しました。`,
      url: "/mypage/rewards",
      data: { questionId: params.questionId, answerId: params.answerId },
      dedupeKey: `payout-scheduled:best-view:${params.revenueShareId}:${recipient.recipientType}`,
      mandatoryEmail: true,
      context: "best_view_payout_scheduled",
    });
  }
}

export async function verifyBestViewCheckoutSession(
  input: VerifyBestViewCheckoutSessionInput
): Promise<VerifyBestViewCheckoutSessionResult> {
  if ("session" in input && input.session) {
    return finalizeBestViewCheckoutSession(input.session, input.questionId);
  }

  if (!input.sessionId) {
    return { ok: false, reason: "missing_session_id" };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return { ok: false, reason: "stripe_not_configured" };
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(input.sessionId);
    return finalizeBestViewCheckoutSession(session, input.questionId);
  } catch (error: unknown) {
    if (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.code === "resource_missing"
    ) {
      return { ok: false, reason: "session_not_found" };
    }

    console.error("❌ verifyBestViewCheckoutSession error:", {
      message: getSafeErrorMessage(error),
    });
    return { ok: false, reason: "stripe_error" };
  }
}

async function finalizeBestViewCheckoutSession(
  session: Stripe.Checkout.Session,
  expectedQuestionId?: string
): Promise<VerifyBestViewCheckoutSessionResult> {
  const questionId = session.metadata?.questionId;
  const answerId = session.metadata?.answerId;
  const buyerId = session.metadata?.buyerId;
  const buyerEmail = session.metadata?.buyerEmail;
  const buyerUsername = session.metadata?.buyerUsername;
  const buyerName = session.metadata?.buyerName;

  if (session.metadata?.kind !== "best_view") {
    return { ok: false, reason: "invalid_kind" };
  }

  if (!questionId || !answerId || !buyerId) {
    return { ok: false, reason: "missing_metadata" };
  }

  if (expectedQuestionId && questionId !== expectedQuestionId) {
    return { ok: false, reason: "session_mismatch" };
  }

  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    select: {
      id: true,
      questionId: true,
      question: {
        select: {
          userId: true,
          bestAnswerId: true,
          viewerPrice: true,
        },
      },
      userId: true,
    },
  });

  if (
    !answer ||
    answer.questionId !== questionId ||
    !answer.question ||
    answer.question.bestAnswerId !== answerId
  ) {
    return { ok: false, reason: "purchase_subject_not_found" };
  }

  const isPaid = session.payment_status === "paid";

  if (!answer.userId || !answer.question.userId) {
    return { ok: false, reason: "purchase_subject_not_found" };
  }

  const transferGroup = buildBestViewTransferGroup(questionId, answerId);
  const stripe = getStripe();
  const stripeChargeId = await resolveCheckoutChargeId(stripe, session).catch(
    () => null
  );

  if (!isPaid) {
    return {
      ok: true,
      session,
      questionId,
      answerId,
      buyerId,
      isPaid: false,
      alreadyPurchased: false,
      createdPurchase: false,
    };
  }

  const existingBySession = session.id
    ? await prisma.purchase.findUnique({
        where: { stripeSessionId: session.id },
        select: {
          id: true,
          amount: true,
          currency: true,
          stripeChargeId: true,
          transferGroup: true,
        },
      })
    : null;

  if (existingBySession) {
    await prisma.purchase.update({
      where: { id: existingBySession.id },
      data: {
        ...(stripeChargeId && !existingBySession.stripeChargeId
          ? { stripeChargeId }
          : {}),
        ...(transferGroup && !existingBySession.transferGroup
          ? { transferGroup }
          : {}),
      },
    });

    await ensureBestViewRevenueShare({
      purchaseId: existingBySession.id,
      questionId,
      answerId,
      buyerId,
      questionOwnerId: answer.question.userId,
      answerOwnerId: answer.userId,
      grossAmount: existingBySession.amount,
      currency: existingBySession.currency,
      stripeChargeId: stripeChargeId ?? existingBySession.stripeChargeId,
      transferGroup: transferGroup ?? existingBySession.transferGroup,
    });

    return {
      ok: true,
      session,
      questionId,
      answerId,
      buyerId,
      isPaid: true,
      alreadyPurchased: true,
      createdPurchase: false,
    };
  }

  const existingByUser = await prisma.purchase.findFirst({
    where: {
      userId: buyerId,
      questionId,
      kind: "best_view",
      status: "PAID",
    },
    select: {
      id: true,
      amount: true,
      currency: true,
      stripeChargeId: true,
      transferGroup: true,
    },
  });

  if (existingByUser) {
    await prisma.purchase.update({
      where: { id: existingByUser.id },
      data: {
        ...(stripeChargeId && !existingByUser.stripeChargeId
          ? { stripeChargeId }
          : {}),
        ...(transferGroup && !existingByUser.transferGroup
          ? { transferGroup }
          : {}),
      },
    });

    await ensureBestViewRevenueShare({
      purchaseId: existingByUser.id,
      questionId,
      answerId,
      buyerId,
      questionOwnerId: answer.question.userId,
      answerOwnerId: answer.userId,
      grossAmount: existingByUser.amount,
      currency: existingByUser.currency,
      stripeChargeId: stripeChargeId ?? existingByUser.stripeChargeId,
      transferGroup: transferGroup ?? existingByUser.transferGroup,
    });

    return {
      ok: true,
      session,
      questionId,
      answerId,
      buyerId,
      isPaid: true,
      alreadyPurchased: true,
      createdPurchase: false,
    };
  }

  const amount =
    session.amount_total ?? Math.round(Number(answer.question.viewerPrice ?? 0));

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "purchase_subject_not_found" };
  }

  await ensurePrismaUser({
    id: buyerId,
    email: buyerEmail,
    username: buyerUsername,
    name: buyerName,
  });

  const currency = (session.currency ?? "jpy").toLowerCase();

  const purchase = await prisma.purchase.create({
    data: {
      userId: buyerId,
      questionId,
      stripeSessionId: session.id ?? null,
      amount: Math.round(amount),
      status: "PAID",
      kind: "best_view",
      currency,
      stripeChargeId,
      transferGroup,
    },
    select: {
      id: true,
      amount: true,
      currency: true,
    },
  });

  await ensureBestViewRevenueShare({
    purchaseId: purchase.id,
    questionId,
    answerId,
    buyerId,
    questionOwnerId: answer.question.userId,
    answerOwnerId: answer.userId,
    grossAmount: purchase.amount,
    currency: purchase.currency,
    stripeChargeId,
    transferGroup,
  });

  return {
    ok: true,
    session,
    questionId,
    answerId,
    buyerId,
    isPaid: true,
    alreadyPurchased: false,
    createdPurchase: true,
  };
}
