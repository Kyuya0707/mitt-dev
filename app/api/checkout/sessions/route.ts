// app/api/checkout/sessions/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // Stripe/PrismaはNodeランタイム想定

export async function POST(req: Request) {
  try {
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

    if (negotiation.status !== "PENDING") {
      return NextResponse.json(
        { error: "This negotiation is not pending" },
        { status: 400 }
      );
    }

    const amount = Math.round(Number(negotiation.proposedAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid proposedAmount" },
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
            product_data: { name: "KnowValue 回答の閲覧（交渉承諾）" },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        negotiationId,
        questionId,
        answerId,
        proposedAmount: String(amount),
      },
      success_url: `${baseUrl}/questions/${questionId}?paid=1`,
      cancel_url: `${baseUrl}/questions/${questionId}?cancel=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("❌ /api/checkout/sessions error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Stripe error" },
      { status: 500 }
    );
  }
}
