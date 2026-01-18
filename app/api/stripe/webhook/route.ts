// app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import prisma from "@/lib/prisma";

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");

  if (!sig || !endpointSecret) {
    console.error("Missing Stripe signature or endpoint secret");
    return new NextResponse("Missing Stripe signature or endpoint secret", {
      status: 400,
    });
  }

  let event: any;

  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed.", err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // このMVPでは completed だけ処理
  if (event.type !== "checkout.session.completed") {
    return new NextResponse(null, { status: 200 });
  }

  const session = event.data.object as any;

  const negotiationId = session.metadata?.negotiationId as string | undefined;
  const questionId = session.metadata?.questionId as string | undefined;
  const answerId = session.metadata?.answerId as string | undefined;
  const amountTotal = session.amount_total as number | undefined;

  if (!amountTotal) {
    console.error("Missing amount_total in session");
    return new NextResponse(null, { status: 200 });
  }

  try {
    // =========================================================
    // ✅ A) 交渉決済（negotiationId がある場合）
    // =========================================================
    if (negotiationId) {
      const nego = await prisma.negotiation.findUnique({
        where: { id: negotiationId },
        include: {
          answer: {
            select: {
              id: true,
              questionId: true,
              question: { select: { userId: true } }, // 質問者 = payer
            },
          },
        },
      });

      if (!nego || !nego.answer) {
        console.error("Negotiation not found:", negotiationId);
        return new NextResponse(null, { status: 200 });
      }

      const payerUserId = nego.answer.question?.userId;
      const qId = nego.answer.questionId;

      if (!payerUserId || !qId) {
        console.error("Negotiation has no payer userId / questionId:", {
          negotiationId,
          payerUserId,
          qId,
        });
        return new NextResponse(null, { status: 200 });
      }

      // すでにACCEPTEDなら何もしない（Stripeの再送対策）
      if (nego.status === "ACCEPTED") {
        console.log("✅ negotiation already accepted:", negotiationId);
        return new NextResponse(null, { status: 200 });
      }

      // Purchase重複防止：MVPは questionId + userId + amount で軽めに防ぐ
      // ※本気で固めるなら Purchaseに negotiationId を持たせて一意制約にする（後でやる）
      const existing = await prisma.purchase.findFirst({
        where: {
          questionId: qId,
          userId: payerUserId,
          amount: amountTotal,
        },
      });

      if (!existing) {
        await prisma.purchase.create({
          data: {
            questionId: qId,
            userId: payerUserId,
            amount: amountTotal,
          },
        });
      }

      // ✅ 交渉を承諾済みに
      await prisma.negotiation.update({
        where: { id: negotiationId },
        data: { status: "ACCEPTED" },
      });

      console.log("✅ Negotiation accepted:", negotiationId);
      return new NextResponse(null, { status: 200 });
    }

    // =========================================================
    // ✅ B) 質問投稿の決済（questionId がある場合）
    // =========================================================
    if (!questionId) {
      console.error("Missing questionId in metadata (and no negotiationId)");
      return new NextResponse(null, { status: 200 });
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true, userId: true },
    });

    if (!question || !question.userId) {
      console.error("Question not found or has no userId:", questionId);
      return new NextResponse(null, { status: 200 });
    }

    const existing = await prisma.purchase.findFirst({
      where: {
        questionId,
        userId: question.userId,
      },
    });

    if (!existing) {
      await prisma.purchase.create({
        data: {
          questionId,
          userId: question.userId,
          amount: amountTotal,
        },
      });
    }

    await prisma.question.update({
      where: { id: questionId },
      data: { isPaid: true },
    });

    console.log("✅ Question marked as paid:", questionId);
    return new NextResponse(null, { status: 200 });
  } catch (e) {
    console.error("❌ webhook handler error:", e);
    // Stripe再送ループ回避のため200で返す
    return new NextResponse(null, { status: 200 });
  }
}
