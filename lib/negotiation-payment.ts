import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { sendAdminPayoutNotification } from "@/lib/admin-notifications";
import {
  NOTIFICATION_TYPES,
  safeCreateUserNotification,
} from "@/lib/notifications";
import { getSafeErrorMessage } from "@/lib/safe-error";

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

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
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

    console.error("❌ verifyNegotiationCheckoutSession error:", {
      message: getSafeErrorMessage(error),
    });
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
      proposedAmount: true,
      answer: {
        select: {
          id: true,
          userId: true,
          user: {
            select: {
              username: true,
              email: true,
              stripeAccountId: true,
            },
          },
        },
      },
      question: {
        select: {
          title: true,
          rewardAmount: true,
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

  const rewardAmount = Math.round(Number(negotiation.question?.rewardAmount));
  const proposedAmount = Math.round(Number(negotiation.proposedAmount));
  const chargedAmount = proposedAmount - rewardAmount;

  if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) {
    return { ok: false, reason: "stripe_error" };
  }

  if (!Number.isFinite(proposedAmount) || proposedAmount <= 0) {
    return { ok: false, reason: "stripe_error" };
  }

  if (!Number.isFinite(chargedAmount) || chargedAmount <= 0) {
    return { ok: false, reason: "stripe_error" };
  }

  const answerUserId = negotiation.answer?.userId;

  if (!answerUserId) {
    return { ok: false, reason: "negotiation_not_found" };
  }

  const createdNegotiation = await prisma.$transaction(async (tx) => {
    const updatedNegotiation = await tx.negotiation.update({
      where: { id: negotiationId },
      data: { status: "ACCEPTED" },
      select: {
        id: true,
        questionId: true,
        status: true,
        answer: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                username: true,
                email: true,
                stripeAccountId: true,
              },
            },
          },
        },
        question: {
          select: {
            title: true,
          },
        },
      },
    });

    const payoutUserId = updatedNegotiation.answer.userId;

    if (!payoutUserId) {
      throw new Error("Negotiation answer user is missing");
    }

    try {
      const createdPayout = await tx.payout.create({
        data: {
          userId: payoutUserId,
          questionId,
          answerId: updatedNegotiation.answer.id,
          negotiationId,
          kind: "negotiation_reward",
          description: "交渉追加報酬",
          grossAmount: chargedAmount,
          platformFeeAmount: 0,
          netAmount: chargedAmount,
          amount: chargedAmount,
          currency: "jpy",
          status: "pending",
          stripeAccountId:
            updatedNegotiation.answer.user?.stripeAccountId ?? null,
        },
        select: {
          id: true,
          amount: true,
          user: {
            select: {
              username: true,
              email: true,
            },
          },
        },
      });

      return {
        created: true as const,
        negotiation: updatedNegotiation,
        payout: createdPayout,
        answerUserId: payoutUserId,
      };
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const existingPayout = await tx.payout.findUnique({
        where: { negotiationId },
        select: {
          id: true,
          amount: true,
          user: {
            select: {
              username: true,
              email: true,
            },
          },
        },
      });

      if (!existingPayout) {
        throw error;
      }

      return {
        created: false as const,
        negotiation: updatedNegotiation,
        payout: existingPayout,
        answerUserId: payoutUserId,
      };
    }
  });

  if (createdNegotiation.created) {
    await safeCreateUserNotification({
      userId: createdNegotiation.answerUserId,
      type: NOTIFICATION_TYPES.NEGOTIATION_ACCEPTED,
      message: `あなたの交渉提案が承認されました: ${createdNegotiation.negotiation.question?.title ?? "質問"}`,
      url: `/questions/${questionId}?from=notification`,
      data: {
        questionId,
        answerId: createdNegotiation.negotiation.answer.id,
        negotiationId,
      },
      context: "negotiation_accepted",
    });

    if (createdNegotiation.payout) {
      await sendAdminPayoutNotification({
        payoutType: "negotiation_reward",
        amount: createdNegotiation.payout.amount,
        recipientName: createdNegotiation.payout.user?.username ?? undefined,
        recipientEmail: createdNegotiation.payout.user?.email,
        questionId,
        answerId: createdNegotiation.negotiation.answer.id,
        adminPath: "/admin/payouts",
      });
    }
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
