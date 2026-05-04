// app/api/checkout/question/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getBaseUrl } from "@/lib/site-url";

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
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "ログインしてください" },
        { status: 401 }
      );
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
    const q = await prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true, rewardAmount: true, userId: true, isPaid: true },
    });

    if (!q) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    if (q.userId !== currentUser.id) {
      return NextResponse.json(
        { error: "この質問の決済を開始する権限がありません" },
        { status: 403 }
      );
    }

    if (q.isPaid) {
      return NextResponse.json(
        { error: "この質問はすでに決済済みです" },
        { status: 400 }
      );
    }

    const amount = q.rewardAmount;
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid rewardAmount" },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
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
      },
      success_url: `${baseUrl}/questions/${questionId}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/questions/${questionId}?cancel=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    console.error("❌ /api/checkout/question error:", e);
    return NextResponse.json(
      { error: getErrorMessage(e) },
      { status: 500 }
    );
  }
}
