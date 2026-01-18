// app/api/checkout/question/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const questionId = body.questionId as string | undefined;

    if (!questionId) {
      return NextResponse.json(
        { error: "questionId is required" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SITE_URL is not set" },
        { status: 500 }
      );
    }

    // ✅ DBから rewardAmount を取得（改ざん防止）
    const q = await prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true, rewardAmount: true },
    });

    if (!q) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const amount = q.rewardAmount;
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid rewardAmount" },
        { status: 400 }
      );
    }

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
        kind: "question",
        questionId,
      },
      success_url: `${baseUrl}/questions/${questionId}?paid=1`,
      cancel_url: `${baseUrl}/questions/${questionId}?cancel=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error("❌ /api/checkout/question error:", e);
    return NextResponse.json(
      { error: e.message ?? "Stripe error" },
      { status: 500 }
    );
  }
}
