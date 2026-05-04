// app/api/checkout/sessions/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs"; // Stripe/PrismaはNodeランタイム想定

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
    const negotiationId = body.negotiationId as string | undefined;

    if (!negotiationId) {
      return NextResponse.json(
        { error: "negotiationId is required" },
        { status: 400 }
      );
    }

    // ✅ baseUrl は env 優先、なければリクエストから組み立て
    const envBaseUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const baseUrl = envBaseUrl && envBaseUrl.length > 0
      ? envBaseUrl
      : new URL(req.url).origin;

    // ✅ env未設定でビルド落ちしないように、ここで判定して返す
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "STRIPE_SECRET_KEY is not set" },
        { status: 500 }
      );
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "DATABASE_URL is not set" },
        { status: 500 }
      );
    }

    // ✅ 遅延import（ビルド時評価で落ちないようにする）
    const [{ stripe }, prismaModule] = await Promise.all([
      import("@/lib/stripe"),
      import("@/lib/prisma"),
    ]);
    const prisma = prismaModule.default;

    const negotiation = await prisma.negotiation.findUnique({
      where: { id: negotiationId },
      select: {
        id: true,
        status: true,
        proposedAmount: true,
        questionId: true,
        question: {
          select: {
            rewardAmount: true,
            userId: true,
          },
        },
        answer: {
          select: { id: true, questionId: true },
        },
      },
    });

    if (!negotiation || !negotiation.answer) {
      return NextResponse.json(
        { error: "Negotiation not found" },
        { status: 404 }
      );
    }

    if (negotiation.question?.userId !== currentUser.id) {
      return NextResponse.json(
        { error: "この交渉の追加決済を開始する権限がありません" },
        { status: 403 }
      );
    }

    if (negotiation.status !== "PENDING") {
      return NextResponse.json(
        { error: "This negotiation is not pending" },
        { status: 400 }
      );
    }

    const proposedAmount = Math.round(Number(negotiation.proposedAmount));
    const originalRewardAmount = Math.round(
      Number(negotiation.question?.rewardAmount)
    );
    const chargedAmount = proposedAmount - originalRewardAmount;

    if (!Number.isFinite(proposedAmount) || proposedAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid proposedAmount" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(originalRewardAmount) || originalRewardAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid originalRewardAmount" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(chargedAmount) || chargedAmount <= 0) {
      return NextResponse.json(
        { error: "追加決済は不要です" },
        { status: 400 }
      );
    }

    const questionId = negotiation.answer.questionId;
    const answerId = negotiation.answer.id;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "jpy",
            product_data: { name: "KnowValue 交渉成立時の追加支払い" },
            unit_amount: chargedAmount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        kind: "negotiation_accept",
        negotiationId,
        questionId,
        answerId,
        originalRewardAmount: String(originalRewardAmount),
        proposedAmount: String(proposedAmount),
        chargedAmount: String(chargedAmount),
      },
      success_url: `${baseUrl}/questions/${questionId}?negotiation_paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/questions/${questionId}?negotiation_cancel=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error("❌ /api/checkout/sessions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stripe error" },
      { status: 500 }
    );
  }
}
