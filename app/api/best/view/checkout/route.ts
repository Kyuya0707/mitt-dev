import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ensurePrismaUser } from "@/lib/ensure-prisma-user";
import { getBaseUrl } from "@/lib/site-url";
import { getSafeErrorMessage } from "@/lib/safe-error";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
    }

    try {
      const metadata = user.user_metadata ?? {};
      await ensurePrismaUser({
        id: user.id,
        email: user.email,
        username:
          typeof metadata.username === "string" ? metadata.username : undefined,
        name:
          typeof metadata.full_name === "string" ? metadata.full_name : undefined,
      });
    } catch (error) {
      console.error("❌ failed to ensure prisma user before best checkout:", {
        message: getSafeErrorMessage(error),
      });
      return NextResponse.json(
        { error: "購入ユーザー情報の同期に失敗しました。再度ログインしてください。" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const answerId = body.answerId as string | undefined;
    if (!answerId) {
      return NextResponse.json({ error: "answerId is required" }, { status: 400 });
    }

    const answer = await prisma.answer.findUnique({
      where: { id: answerId },
      select: {
        id: true,
        userId: true,
        questionId: true,
        question: {
          select: {
            id: true,
            userId: true,
            bestAnswerId: true,
            isPaid: true,
            viewerPrice: true,
          },
        },
      },
    });

    if (!answer || !answer.question) {
      return NextResponse.json(
        { error: "Answer or question not found" },
        { status: 404 }
      );
    }

    if (!answer.question.isPaid) {
      return NextResponse.json(
        { error: "この質問はまだ公開されていません" },
        { status: 403 }
      );
    }

    if (answer.question.userId === user.id) {
      return NextResponse.json(
        { error: "質問者は購入不要です" },
        { status: 400 }
      );
    }

    if (answer.userId === user.id) {
      return NextResponse.json(
        { error: "回答者本人は購入不要です" },
        { status: 400 }
      );
    }

    if (answer.question.bestAnswerId !== answer.id) {
      return NextResponse.json({ error: "BEST回答ではありません" }, { status: 400 });
    }

    const amount = Number(answer.question.viewerPrice);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "この質問はBEST閲覧価格が未設定のため、購入できません" },
        { status: 400 }
      );
    }

    const existingPurchase = await prisma.purchase.findFirst({
      where: {
        userId: user.id,
        questionId: answer.questionId,
        status: "PAID",
      },
      select: { id: true },
    });

    if (existingPurchase) {
      return NextResponse.json(
        { error: "すでにBEST回答を閲覧できます" },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl();

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "STRIPE_SECRET_KEY is not set" },
        { status: 500 }
      );
    }

    const [{ stripe }] = await Promise.all([import("@/lib/stripe")]);
    const metadata = user.user_metadata ?? {};

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      wallet_options: {
        link: {
          display: "never",
        },
      },
      line_items: [
        {
          price_data: {
            currency: "jpy",
            product_data: { name: "KnowValue BEST回答の閲覧" },
            unit_amount: Math.round(amount),
          },
          quantity: 1,
        },
      ],
      metadata: {
        kind: "best_view",
        answerId: answer.id,
        questionId: answer.questionId,
        buyerId: user.id,
        buyerEmail: user.email ?? "",
        buyerUsername:
          typeof metadata.username === "string" ? metadata.username : "",
        buyerName:
          typeof metadata.full_name === "string" ? metadata.full_name : "",
        amount: String(Math.round(amount)),
      },
      success_url: `${baseUrl}/questions/${answer.questionId}?best_view_paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/questions/${answer.questionId}?best_view_cancel=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("❌ /api/best/view/checkout error:", {
      message: getSafeErrorMessage(error),
    });
    return NextResponse.json(
      { error: "決済セッションの作成に失敗しました" },
      { status: 500 }
    );
  }
}
