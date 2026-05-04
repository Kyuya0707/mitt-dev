import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { createCategoryQuestionNotifications } from "@/lib/notifications";

type VerifyQuestionCheckoutSessionResult =
  | {
      ok: true;
      session: Stripe.Checkout.Session;
      questionId: string;
      isPaid: boolean;
      alreadyPaid: boolean;
      updatedQuestion: boolean;
    }
  | {
      ok: false;
      reason:
        | "missing_session_id"
        | "stripe_not_configured"
        | "session_not_found"
        | "missing_question_id"
        | "session_mismatch"
        | "invalid_kind"
        | "stripe_error";
    };

type VerifyQuestionCheckoutSessionInput =
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

export async function verifyQuestionCheckoutSession(
  input: VerifyQuestionCheckoutSessionInput
): Promise<VerifyQuestionCheckoutSessionResult> {
  if ("session" in input && input.session) {
    return finalizeQuestionCheckoutSession(input.session, input.questionId);
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
    return finalizeQuestionCheckoutSession(session, input.questionId);
  } catch (error: unknown) {
    if (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.code === "resource_missing"
    ) {
      return { ok: false, reason: "session_not_found" };
    }

    console.error("❌ verifyQuestionCheckoutSession error:", error);
    return { ok: false, reason: "stripe_error" };
  }
}

async function finalizeQuestionCheckoutSession(
  session: Stripe.Checkout.Session,
  expectedQuestionId?: string
): Promise<VerifyQuestionCheckoutSessionResult> {
  const questionId = session.metadata?.questionId;
  const sessionUserId = session.metadata?.userId;
  const sessionId = session.id;

  if (session.metadata?.kind !== "question_post") {
    return { ok: false, reason: "invalid_kind" };
  }

  if (!questionId) {
    return { ok: false, reason: "missing_question_id" };
  }

  if (expectedQuestionId && questionId !== expectedQuestionId) {
    return { ok: false, reason: "session_mismatch" };
  }

  const isPaid = session.payment_status === "paid";

  if (!isPaid) {
    return {
      ok: true,
      session,
      questionId,
      isPaid: false,
      alreadyPaid: false,
      updatedQuestion: false,
    };
  }

  const current = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      isPaid: true,
      userId: true,
      title: true,
      categoryId: true,
      rewardAmount: true,
      category: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!current) {
    return { ok: false, reason: "session_mismatch" };
  }

  const purchaseUserId = sessionUserId ?? current.userId;

  const existingBySession = sessionId
    ? await prisma.purchase.findUnique({
        where: { stripeSessionId: sessionId },
        select: { id: true },
      })
    : null;

  if (existingBySession) {
    return {
      ok: true,
      session,
      questionId,
      isPaid: true,
      alreadyPaid: true,
      updatedQuestion: false,
    };
  }

  const existingByUser = purchaseUserId
    ? await prisma.purchase.findFirst({
        where: {
          userId: purchaseUserId,
          questionId,
          status: "PAID",
        },
        select: { id: true, stripeSessionId: true },
      })
    : null;

  const shouldCreatePurchase = !!purchaseUserId && !existingByUser;
  const shouldUpdateExistingPurchaseSessionId =
    !!sessionId &&
    !!existingByUser &&
    !existingByUser.stripeSessionId;

  await prisma.$transaction(async (tx) => {
    if (!current.isPaid) {
      await tx.question.update({
        where: { id: questionId },
        data: { isPaid: true },
      });
    }

    if (shouldCreatePurchase && purchaseUserId) {
      await tx.purchase.create({
        data: {
          userId: purchaseUserId,
          questionId,
          amount: current.rewardAmount,
          currency: (session.currency ?? "jpy").toLowerCase(),
          stripeSessionId: sessionId ?? null,
          status: "PAID",
        },
      });
    }

    if (shouldUpdateExistingPurchaseSessionId && existingByUser) {
      await tx.purchase.update({
        where: { id: existingByUser.id },
        data: {
          stripeSessionId: sessionId,
        },
      });
    }
  });

  if (!current.isPaid && current.userId && current.category?.name) {
    await createCategoryQuestionNotifications({
      actorUserId: current.userId,
      questionId: current.id,
      questionTitle: current.title,
      categoryId: current.categoryId,
      categoryName: current.category.name,
    });
  }

    return {
      ok: true,
      session,
      questionId,
      isPaid: true,
      alreadyPaid: current.isPaid,
      updatedQuestion: !current.isPaid,
    };
}
