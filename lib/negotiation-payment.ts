import Stripe from "stripe";
import prisma from "@/lib/prisma";
import {
  NOTIFICATION_TYPES,
  safeCreateUserNotification,
} from "@/lib/notifications";
import {
  buildNegotiationTransferGroup,
  resolveCheckoutChargeId,
} from "@/lib/stripe-connect-transfer";
import { getSafeErrorMessage } from "@/lib/safe-error";

type Result =
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
        | "amount_mismatch"
        | "stripe_error";
    };

type Input =
  | { questionId: string; sessionId?: string | null; session?: never }
  | { questionId?: string; sessionId?: never; session: Stripe.Checkout.Session };

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

export async function verifyNegotiationCheckoutSession(input: Input): Promise<Result> {
  if ("session" in input && input.session) {
    return finalize(input.session, input.questionId);
  }
  if (!input.sessionId) return { ok: false, reason: "missing_session_id" };
  if (!process.env.STRIPE_SECRET_KEY) {
    return { ok: false, reason: "stripe_not_configured" };
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(input.sessionId);
    return finalize(session, input.questionId);
  } catch (error) {
    if (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.code === "resource_missing"
    ) {
      return { ok: false, reason: "session_not_found" };
    }
    console.error("verifyNegotiationCheckoutSession failed", {
      message: getSafeErrorMessage(error),
    });
    return { ok: false, reason: "stripe_error" };
  }
}

async function finalize(
  session: Stripe.Checkout.Session,
  expectedQuestionId?: string
): Promise<Result> {
  if (session.metadata?.kind !== "negotiation_accept") {
    return { ok: false, reason: "invalid_kind" };
  }
  const negotiationId = session.metadata.negotiationId;
  const questionId = session.metadata.questionId;
  if (!negotiationId || !questionId) {
    return { ok: false, reason: "missing_metadata" };
  }
  if (expectedQuestionId && expectedQuestionId !== questionId) {
    return { ok: false, reason: "session_mismatch" };
  }

  const negotiation = await prisma.negotiation.findUnique({
    where: { id: negotiationId },
    select: {
      id: true,
      questionId: true,
      status: true,
      proposedAmount: true,
      answer: { select: { id: true, userId: true } },
      question: { select: { title: true, userId: true, isClosed: true } },
    },
  });
  if (
    !negotiation ||
    negotiation.questionId !== questionId ||
    !negotiation.answer.userId ||
    !negotiation.question.userId ||
    negotiation.question.isClosed
  ) {
    return { ok: false, reason: "negotiation_not_found" };
  }

  if (session.payment_status !== "paid") {
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

  const existingPurchase = await prisma.purchase.findUnique({
    where: { stripeSessionId: session.id },
    select: { id: true },
  });
  if (existingPurchase) {
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

  if (negotiation.status !== "PENDING") {
    return { ok: false, reason: "negotiation_not_found" };
  }

  const additionalReward = negotiation.proposedAmount;
  const platformFee = Math.floor(additionalReward * 0.1);
  const checkoutAmount = additionalReward + platformFee;
  if (session.amount_total !== checkoutAmount) {
    return { ok: false, reason: "amount_mismatch" };
  }

  const stripe = getStripe();
  const stripeChargeId = await resolveCheckoutChargeId(stripe, session).catch(
    () => null
  );
  const transferGroup = buildNegotiationTransferGroup(negotiationId);
  const acceptedAt = new Date(session.created * 1000);
  const answerDueAt = new Date(acceptedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  const updated = await prisma.$transaction(async (tx) => {
    const accepted = await tx.negotiation.updateMany({
      where: { id: negotiationId, status: "PENDING" },
      data: { status: "ACCEPTED", acceptedAt, answerDueAt },
    });
    if (accepted.count === 0) return false;

    await tx.purchase.create({
      data: {
        userId: negotiation.question.userId!,
        questionId,
        kind: "negotiation_accept",
        negotiationId,
        amount: checkoutAmount,
        currency: (session.currency ?? "jpy").toLowerCase(),
        stripeSessionId: session.id,
        stripeChargeId,
        transferGroup,
        status: "PAID",
      },
    });
    await tx.eventLog.create({
      data: {
        type: "negotiation_accepted_paid",
        payload: {
          negotiationId,
          questionId,
          answerId: negotiation.answer.id,
          additionalReward,
          platformFee,
          checkoutAmount,
          answerDueAt: answerDueAt.toISOString(),
        },
      },
    });
    return true;
  });

  if (updated) {
    await safeCreateUserNotification({
      userId: negotiation.answer.userId,
      type: NOTIFICATION_TYPES.NEGOTIATION_ACCEPTED,
      message: `追加報酬${additionalReward.toLocaleString("ja-JP")}円の提案が承認されました。7日以内に「${negotiation.question.title}」へ回答を投稿してください。`,
      url: `/questions/${questionId}?from=notification`,
      data: { questionId, answerId: negotiation.answer.id, negotiationId },
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
    updatedNegotiation: updated,
  };
}
