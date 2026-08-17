import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getBaseUrl } from "@/lib/site-url";
import { getUserMutationRestriction } from "@/lib/user-access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }
  const restriction = await getUserMutationRestriction(user.id);
  if (restriction) {
    return NextResponse.json({ error: restriction }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    questionId?: string;
    shortenDeadline?: boolean;
  };
  if (!body.questionId) {
    return NextResponse.json({ error: "質問IDが必要です" }, { status: 400 });
  }

  const question = await prisma.question.findFirst({
    where: {
      id: body.questionId,
      userId: user.id,
      isPaid: true,
      isClosed: false,
      cancellationRequests: { none: { status: "approved" } },
    },
    select: { id: true, title: true, rewardAmount: true, boostCount: true },
  });
  if (!question) {
    return NextResponse.json({ error: "質問が見つかりません" }, { status: 404 });
  }
  if (question.rewardAmount < 3000) {
    return NextResponse.json(
      { error: "Boostは報酬3,000円以上の質問で利用できます" },
      { status: 400 }
    );
  }
  if (question.boostCount >= 3) {
    return NextResponse.json(
      { error: "この質問はBoostを3回利用済みです" },
      { status: 400 }
    );
  }

  const [{ stripe }] = await Promise.all([import("@/lib/stripe")]);
  const amount = Math.floor(question.rewardAmount * 0.1);
  const baseUrl = getBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    wallet_options: { link: { display: "never" } },
    line_items: [
      {
        price_data: {
          currency: "jpy",
          product_data: { name: "KnowValue 質問Boost（3日間）" },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      kind: "question_boost",
      questionId: question.id,
      userId: user.id,
      shortenDeadline: body.shortenDeadline ? "true" : "false",
    },
    success_url: `${baseUrl}/questions/${question.id}?boost_paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/questions/${question.id}?boost_cancel=1`,
  });

  return NextResponse.json({ url: session.url });
}
