import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { ensurePrismaUser } from "@/lib/ensure-prisma-user";
import { sendAdminPayoutNotification } from "@/lib/admin-notifications";
import { getSafeErrorMessage } from "@/lib/safe-error";

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
      currency: existing.currency,
    });
    return existing;
  }

  const questionOwnerAmount = Math.floor(params.grossAmount * 0.7);
  const platformFeeAmount = params.grossAmount - questionOwnerAmount;

  const revenueShare = await prisma.bestViewRevenueShare.create({
    data: {
      purchaseId: params.purchaseId,
      questionId: params.questionId,
      answerId: params.answerId,
      buyerId: params.buyerId,
      questionOwnerId: params.questionOwnerId,
      answerOwnerId: params.answerOwnerId,
      grossAmount: params.grossAmount,
      questionOwnerAmount,
      answerOwnerAmount: 0,
      platformFeeAmount,
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
    currency: revenueShare.currency,
  });

  return revenueShare;
}

async function ensureBestViewPayouts(params: {
  revenueShareId: string;
  questionId: string;
  answerId: string;
  questionOwnerId: string;
  questionOwnerAmount: number;
  currency: string;
}) {
  const existingQuestionOwnerPayout = await prisma.bestViewPayout.findUnique({
    where: {
      revenueShareId_recipientType: {
        revenueShareId: params.revenueShareId,
        recipientType: "question_owner",
      },
    },
    select: { id: true },
  });

  if (!existingQuestionOwnerPayout) {
    const createdPayout = await prisma.bestViewPayout.create({
      data: {
        revenueShareId: params.revenueShareId,
        recipientUserId: params.questionOwnerId,
        recipientType: "question_owner",
        amount: params.questionOwnerAmount,
        currency: params.currency,
        status: "pending",
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
        select: { id: true },
      })
    : null;

  if (existingBySession) {
    const existingPurchase = await prisma.purchase.findUnique({
      where: { id: existingBySession.id },
      select: {
        id: true,
        amount: true,
        currency: true,
      },
    });

    if (existingPurchase) {
      await ensureBestViewRevenueShare({
        purchaseId: existingPurchase.id,
        questionId,
        answerId,
        buyerId,
        questionOwnerId: answer.question.userId,
        answerOwnerId: answer.userId,
        grossAmount: existingPurchase.amount,
        currency: existingPurchase.currency,
      });
    }

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
      status: "PAID",
    },
    select: { id: true },
  });

  if (existingByUser) {
    const existingPurchase = await prisma.purchase.findUnique({
      where: { id: existingByUser.id },
      select: {
        id: true,
        amount: true,
        currency: true,
      },
    });

    if (existingPurchase) {
      await ensureBestViewRevenueShare({
        purchaseId: existingPurchase.id,
        questionId,
        answerId,
        buyerId,
        questionOwnerId: answer.question.userId,
        answerOwnerId: answer.userId,
        grossAmount: existingPurchase.amount,
        currency: existingPurchase.currency,
      });
    }

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
      currency,
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
