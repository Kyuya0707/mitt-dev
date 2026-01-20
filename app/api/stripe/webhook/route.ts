// app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // Stripe/PrismaはNodeランタイム想定

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

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed.", err?.message);
      return new NextResponse(`Webhook Error: ${err?.message ?? "unknown"}`, {
        status: 400,
      });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;

      // 種別（質問投稿 or 交渉承諾）
      const kind = session.metadata?.kind as string | undefined;

      // ---- 交渉承諾（A-6） ----
      const negotiationId = session.metadata?.negotiationId as
        | string
        | undefined;

      if (negotiationId) {
        // ✅ ここでは status を更新しない（enumが未確定のため）
        // 後で schema の NegotiationStatus を見て正しい値に合わせて更新する
        console.log("✅ Negotiation payment completed:", {
          negotiationId,
          kind,
          metadata: session.metadata,
        });
        return new NextResponse(null, { status: 200 });
      }

      // ---- 質問投稿（reward） ----
      const questionId = session.metadata?.questionId as string | undefined;
      const amountTotal = session.amount_total as number | undefined;

      if (questionId && amountTotal) {
        await prisma.question.update({
          where: { id: questionId },
          data: { isPaid: true },
        });

        console.log("✅ Question marked as paid:", questionId);
        return new NextResponse(null, { status: 200 });
      }

      console.log("ℹ️ checkout.session.completed but no usable metadata", {
        kind,
        metadata: session.metadata,
      });
    } else {
      console.log(`Unhandled event type ${event.type}`);
    }

    return new NextResponse(null, { status: 200 });
  } catch (e: any) {
    console.error("❌ /api/stripe/webhook error:", e);
    return new NextResponse("Webhook handler error", { status: 500 });
  }
}
