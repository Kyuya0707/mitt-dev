// app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { verifyBestViewCheckoutSession } from "@/lib/best-view-payment";
import { verifyQuestionCheckoutSession } from "@/lib/question-payment";
import { verifyNegotiationCheckoutSession } from "@/lib/negotiation-payment";
import { syncStripeConnectAccountStatusFromAccount } from "@/lib/stripe-connect";

export const runtime = "nodejs";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown";
}

function getErrorCode(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : null;
}

function logWebhookIssue(input: {
  eventType: string;
  kind?: string;
  reason?: string | null;
  paymentStatus?: string | null;
  message?: string | null;
  code?: string | null;
}) {
  console.error("Stripe webhook issue", {
    eventType: input.eventType,
    kind: input.kind ?? null,
    reason: input.reason ?? null,
    paymentStatus: input.paymentStatus ?? null,
    message: input.message ?? null,
    code: input.code ?? null,
  });
}

export async function POST(req: Request) {
  try {
    const sig = req.headers.get("stripe-signature");
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !endpointSecret) {
      console.error("Missing Stripe signature or STRIPE_WEBHOOK_SECRET");
      return new NextResponse("Missing Stripe signature or webhook secret", {
        status: 400,
      });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("Missing STRIPE_SECRET_KEY");
      return new NextResponse("Missing STRIPE_SECRET_KEY", { status: 500 });
    }

    if (!process.env.DATABASE_URL) {
      console.error("Missing DATABASE_URL");
      return new NextResponse("Missing DATABASE_URL", { status: 500 });
    }

    // ✅ 遅延 import（ビルド時評価を回避）
    const [{ stripe }, prismaModule] = await Promise.all([
      import("@/lib/stripe"),
      import("@/lib/prisma"),
    ]);
    const prisma = prismaModule.default;

    const body = await req.text();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err: unknown) {
      logWebhookIssue({
        eventType: "webhook.signature_verification",
        reason: "signature_verification_failed",
        message: getErrorMessage(err),
        code: getErrorCode(err),
      });
      return new NextResponse(`Webhook Error: ${getErrorMessage(err)}`, {
        status: 400,
      });
    }

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;

      const existingUser = await prisma.user.findUnique({
        where: { stripeAccountId: account.id },
        select: { id: true },
      });

      if (!existingUser) {
        return new NextResponse(null, { status: 200 });
      }

      await syncStripeConnectAccountStatusFromAccount(existingUser.id, account);
      return new NextResponse(null, { status: 200 });
    }

    // ✅ 決済完了イベント
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const sessionId = session.id as string | undefined;
      const kind = session.metadata?.kind as string | undefined;
      const paymentStatus = session.payment_status as string | undefined;

      // ---- BEST回答閲覧の支払い（PR3）----
      if (kind === "best_view") {
        const result = await verifyBestViewCheckoutSession({ session });

        if (!result.ok) {
          if (result.reason === "missing_metadata") {
            await prisma.eventLog.create({
              data: {
                type: "BEST_VIEW_WEBHOOK_METADATA_MISSING",
                payload: {
                  sessionId,
                  paymentStatus,
                  metadata: session.metadata ?? null,
                },
              },
            });
          } else {
            await prisma.eventLog.create({
              data: {
                type: "BEST_VIEW_WEBHOOK_VERIFY_FAILED",
                payload: {
                  sessionId,
                  paymentStatus,
                  metadata: session.metadata ?? null,
                  reason: result.reason,
                },
              },
            });
          }

          logWebhookIssue({
            eventType: event.type,
            kind,
            paymentStatus,
            reason: result.reason,
          });
          return new NextResponse(null, { status: 200 });
        }

        if (!result.isPaid) {
          await prisma.eventLog.create({
            data: {
              type: "BEST_VIEW_WEBHOOK_PAYMENT_NOT_PAID",
              payload: {
                sessionId,
                questionId: result.questionId,
                buyerId: result.buyerId,
                answerId: result.answerId,
                paymentStatus: paymentStatus ?? null,
              },
            },
          });
          return new NextResponse(null, { status: 200 });
        }
        return new NextResponse(null, { status: 200 });
      }

      // ---- 質問投稿の支払い ----
      if (kind === "question_post") {
        try {
          const result = await verifyQuestionCheckoutSession({ session });

          if (!result.ok) {
            if (result.reason === "missing_question_id") {
              logWebhookIssue({
                eventType: event.type,
                kind,
                reason: result.reason,
              });
              return new NextResponse(null, { status: 200 });
            }

            logWebhookIssue({
              eventType: event.type,
              kind,
              reason: result.reason,
            });
            return new NextResponse(null, { status: 200 });
          }

          if (!result.isPaid) {
            logWebhookIssue({
              eventType: event.type,
              kind,
              paymentStatus: paymentStatus ?? null,
              reason: "payment_not_paid",
            });
            return new NextResponse(null, { status: 200 });
          }

        } catch (error: unknown) {
          logWebhookIssue({
            eventType: event.type,
            kind,
            reason: "question_update_failed",
            message: getErrorMessage(error),
            code: getErrorCode(error),
          });
          throw error;
        }

        return new NextResponse(null, { status: 200 });
      }

      if (kind === "negotiation_accept") {
        const result = await verifyNegotiationCheckoutSession({ session });

        if (!result.ok) {
          if (result.reason === "missing_metadata") {
            logWebhookIssue({
              eventType: event.type,
              kind,
              reason: result.reason,
            });
            return new NextResponse(null, { status: 200 });
          }

          logWebhookIssue({
            eventType: event.type,
            kind,
            reason: result.reason,
          });
          return new NextResponse(null, { status: 200 });
        }

        if (!result.isPaid) {
          return new NextResponse(null, { status: 200 });
        }
        return new NextResponse(null, { status: 200 });
      }

      return new NextResponse(null, { status: 200 });
    }

    return new NextResponse(null, { status: 200 });
  } catch (e: unknown) {
    logWebhookIssue({
      eventType: "webhook.unhandled_error",
      reason: "unhandled_error",
      message: getErrorMessage(e),
      code: getErrorCode(e),
    });
    return new NextResponse("Webhook handler error", { status: 500 });
  }
}
