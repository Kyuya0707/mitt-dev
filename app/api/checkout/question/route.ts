// app/api/checkout/question/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getQuestionRewardBreakdown } from "@/lib/reward-breakdown";
import { getBaseUrl } from "@/lib/site-url";
import { buildQuestionTransferGroup } from "@/lib/stripe-connect-transfer";
import { durationMs, logPerf, nowMs } from "@/lib/perf";
import { getUserMutationRestriction } from "@/lib/user-access";

export const runtime = "nodejs"; // Stripe/Prismaなので明示（Edge回避）

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  return new Stripe(key);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Stripe error";
}

export async function POST(req: Request) {
  const totalStart = nowMs();
  try {
    const authStart = nowMs();
    const currentUser = await getCurrentUser();
    const authDuration = durationMs(authStart);

    if (!currentUser) {
      return NextResponse.json(
        { error: "ログインしてください" },
        { status: 401 }
      );
    }
    const restriction = await getUserMutationRestriction(currentUser.id);
    if (restriction) {
      return NextResponse.json({ error: restriction }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const questionId = body.questionId as string | undefined;

    if (!questionId) {
      return NextResponse.json(
        { error: "questionId is required" },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl();

    // ✅ DBから rewardAmount を取得（改ざん防止）
    const questionLookupStart = nowMs();
    const q = await prisma.question.findFirst({
      where: {
        id: questionId,
        cancellationRequests: { none: { status: "approved" } },
      },
      select: {
        id: true,
        rewardAmount: true,
        userId: true,
        isPaid: true,
        isClosed: true,
        bestAnswerId: true,
        rewardExpiresAt: true,
        rewardStoppedAt: true,
      },
    });
    const questionLookupDuration = durationMs(questionLookupStart);

    if (!q) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    if (q.userId !== currentUser.id) {
      return NextResponse.json(
        { error: "この質問の決済を開始する権限がありません" },
        { status: 403 }
      );
    }

    const canRestartReward =
      q.isPaid &&
      q.isClosed &&
      !q.bestAnswerId &&
      !!q.rewardStoppedAt &&
      !!q.rewardExpiresAt &&
      q.rewardExpiresAt <= new Date();

    if (q.isPaid && !canRestartReward) {
      return NextResponse.json(
        { error: "この質問はすでに決済済みです" },
        { status: 400 }
      );
    }

    const rewardBreakdown = getQuestionRewardBreakdown(q.rewardAmount);
    const amount = rewardBreakdown.checkoutAmount;
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid rewardAmount" },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    const stripeSessionStart = nowMs();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      payment_intent_data: {
        transfer_group: buildQuestionTransferGroup(questionId),
      },
      wallet_options: {
        link: {
          display: "never",
        },
      },
      line_items: [
        {
          price_data: {
            currency: "jpy",
            product_data: { name: "KnowValue 質問投稿（報酬）" },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        kind: "question_post",
        questionId,
        userId: currentUser.id,
        rewardAmount: String(q.rewardAmount),
        platformFeeAmount: String(rewardBreakdown.platformFeeAmount),
        checkoutAmount: String(amount),
        rewardRenewal: canRestartReward ? "true" : "false",
      },
      success_url: `${baseUrl}/questions/${questionId}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/questions/${questionId}?cancel=1`,
    });
    const stripeSessionDuration = durationMs(stripeSessionStart);

    logPerf("checkout.question.POST", {
      total: `${durationMs(totalStart)}ms`,
      auth: `${authDuration}ms`,
      question: `${questionLookupDuration}ms`,
      stripe: `${stripeSessionDuration}ms`,
      amount,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    console.error("❌ /api/checkout/question error:", {
      message: getErrorMessage(e),
    });
    return NextResponse.json(
      { error: getErrorMessage(e) },
      { status: 500 }
    );
  }
}
