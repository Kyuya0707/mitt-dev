import Stripe from "stripe";
import prisma from "@/lib/prisma";
import {
  NOTIFICATION_TYPES,
  safeCreateUserNotification,
} from "@/lib/notifications";

type VerifyNegotiationCheckoutSessionResult =
  | {
      ok: true;
      session: Stripe.Checkout.Session;
      negotiationId: string;
      questionId: string;
      isPaid: boolean;
      alreadyAccepted: boolean;
      updatedNegotiation: boolean;
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
        | "negotiation_not_found"
        | "stripe_error";
    };

type VerifyNegotiationCheckoutSessionInput =
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

export async function verifyNegotiationCheckoutSession(
  input: VerifyNegotiationCheckoutSessionInput
): Promise<VerifyNegotiationCheckoutSessionResult> {
  if ("session" in input && input.session) {
    return finalizeNegotiationCheckoutSession(input.session, input.questionId);
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
    return finalizeNegotiationCheckoutSession(session, input.questionId);
  } catch (error: unknown) {
    if (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.code === "resource_missing"
    ) {
      return { ok: false, reason: "session_not_found" };
    }

    console.error("❌ verifyNegotiationCheckoutSession error:", error);
    return { ok: false, reason: "stripe_error" };
  }
}

async function finalizeNegotiationCheckoutSession(
  session: Stripe.Checkout.Session,
  expectedQuestionId?: string
): Promise<VerifyNegotiationCheckoutSessionResult> {
  const negotiationId = session.metadata?.negotiationId;
  const questionId = session.metadata?.questionId;

  if (session.metadata?.kind !== "negotiation_accept") {
    return { ok: false, reason: "invalid_kind" };
  }

  if (!negotiationId || !questionId) {
    return { ok: false, reason: "missing_metadata" };
  }

  if (expectedQuestionId && questionId !== expectedQuestionId) {
    return { ok: false, reason: "session_mismatch" };
  }

  const negotiation = await prisma.negotiation.findUnique({
    where: { id: negotiationId },
    select: {
      id: true,
      questionId: true,
      status: true,
      answer: {
        select: {
          id: true,
          userId: true,
        },
      },
      question: {
        select: {
          title: true,
        },
      },
    },
  });

  if (!negotiation || negotiation.questionId !== questionId) {
    return { ok: false, reason: "negotiation_not_found" };
  }

  const isPaid = session.payment_status === "paid";

  if (!isPaid) {
    return {
      ok: true,
      session,
      negotiationId,
      questionId,
      isPaid: false,
      alreadyAccepted: negotiation.status === "ACCEPTED",
      updatedNegotiation: false,
    };
  }

  if (negotiation.status === "ACCEPTED") {
    return {
      ok: true,
      session,
      negotiationId,
      questionId,
      isPaid: true,
      alreadyAccepted: true,
      updatedNegotiation: false,
    };
  }

  await prisma.negotiation.update({
    where: { id: negotiationId },
    data: { status: "ACCEPTED" },
  });

  if (negotiation.answer?.userId) {
    await safeCreateUserNotification({
      userId: negotiation.answer.userId,
      type: NOTIFICATION_TYPES.NEGOTIATION_ACCEPTED,
      message: `あなたの交渉提案が承認されました: ${negotiation.question?.title ?? "質問"}`,
      url: `/questions/${questionId}?from=notification`,
      data: {
        questionId,
        answerId: negotiation.answer.id,
        negotiationId,
      },
      context: "negotiation_accepted",
    });
  }

  return {
    ok: true,
    session,
    negotiationId,
    questionId,
    isPaid: true,
    alreadyAccepted: false,
    updatedNegotiation: true,
  };
}
