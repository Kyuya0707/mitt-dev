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
  if ("session" in input) {
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

  if (current.isPaid) {
    return {
      ok: true,
      session,
      questionId,
      isPaid: true,
      alreadyPaid: true,
      updatedQuestion: false,
    };
  }

  await prisma.question.update({
    where: { id: questionId },
    data: { isPaid: true },
  });

  if (current.userId && current.category?.name) {
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
    alreadyPaid: false,
    updatedQuestion: true,
  };
}
