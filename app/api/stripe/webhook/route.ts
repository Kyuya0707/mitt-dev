// app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

    // ✅ 決済完了イベント
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;

      // Supabase/Stripe 側で metadata に入れている値
      const negotiationId = session.metadata?.negotiationId as
        | string
        | undefined;
      const questionId = session.metadata?.questionId as string | undefined;

      // ---- 交渉承諾の支払い（A-6）----
      if (negotiationId) {
        await prisma.negotiation.update({
          where: { id: negotiationId },
          data: {
            // ✅ enum に存在する値を使う
            status: "ACCEPTED",
          },
        });

        console.log("✅ Negotiation marked as ACCEPTED:", negotiationId);
        return new NextResponse(null, { status: 200 });
      }

      // ---- 質問投稿の支払い（reward）----
      if (questionId) {
        await prisma.question.update({
          where: { id: questionId },
          data: { isPaid: true },
        });

        console.log("✅ Question marked as paid:", questionId);
        return new NextResponse(null, { status: 200 });
      }

      console.log("ℹ️ checkout.session.completed but no usable metadata", {
        metadata: session.metadata,
      });
      return new NextResponse(null, { status: 200 });
    }

    // 他イベントは今は無視でOK（必要になったら追加）
    console.log(`Unhandled event type ${event.type}`);
    return new NextResponse(null, { status: 200 });
  } catch (e: any) {
    console.error("❌ /api/stripe/webhook error:", e);
    return new NextResponse("Webhook handler error", { status: 500 });
  }
}
