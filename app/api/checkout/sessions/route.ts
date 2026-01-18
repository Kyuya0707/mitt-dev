// app/api/checkout/sessions/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const negotiationId = body.negotiationId as string | undefined;

    if (!negotiationId) {
      console.error("❌ negotiationId missing:", { negotiationId });
      return NextResponse.json(
        { error: "negotiationId is required" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!baseUrl) {
      console.error("❌ NEXT_PUBLIC_SITE_URL is not set");
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SITE_URL is not set" },
        { status: 500 }
      );
    }

    // ✅ 交渉情報をDBから取得（ここで金額を確定）
    const negotiation = await prisma.negotiation.findUnique({
      where: { id: negotiationId },
      select: {
        id: true,
        status: true,
        proposedAmount: true,
        answer: {
          select: {
            id: true,
            questionId: true,
          },
        },
      },
    });

    if (!negotiation || !negotiation.answer) {
      return NextResponse.json(
        { error: "Negotiation not found" },
        { status: 404 }
      );
    }

    if (negotiation.status !== "PENDING") {
      return NextResponse.json(
        { error: "This negotiation is not pending" },
        { status: 400 }
      );
    }

    const amount = negotiation.proposedAmount;
    const questionId = negotiation.answer.questionId;
    const answerId = negotiation.answer.id;

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid proposedAmount" },
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
            product_data: {
              name: "KnowValue 回答の閲覧（交渉承諾）",
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      // ✅ Webhookで使う
      metadata: {
        negotiationId,
        questionId,
        answerId,
        proposedAmount: String(amount),
      },

      // ✅ 決済完了後は質問詳細へ戻す
      success_url: `${baseUrl}/questions/${questionId}?paid=1`,
      // ✅ キャンセルしたら戻る
      cancel_url: `${baseUrl}/questions/${questionId}?cancel=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("❌ /api/checkout/sessions error:", error);
    return NextResponse.json(
      { error: error.message ?? "Stripe error" },
      { status: 500 }
    );
  }
}
