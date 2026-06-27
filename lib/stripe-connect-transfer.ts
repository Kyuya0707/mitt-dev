import Stripe from "stripe";

function getTransferGroupPrefix(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function buildQuestionTransferGroup(questionId: string) {
  return getTransferGroupPrefix(`kv_question_${questionId}`);
}

export function buildBestViewTransferGroup(questionId: string, answerId: string) {
  return getTransferGroupPrefix(`kv_best_view_${questionId}_${answerId}`);
}

export function buildNegotiationTransferGroup(negotiationId: string) {
  return getTransferGroupPrefix(`kv_negotiation_${negotiationId}`);
}

export async function resolveCheckoutChargeId(
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!paymentIntentId) {
    return null;
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });

  const latestCharge = paymentIntent.latest_charge;

  if (typeof latestCharge === "string") {
    return latestCharge;
  }

  return latestCharge?.id ?? null;
}
