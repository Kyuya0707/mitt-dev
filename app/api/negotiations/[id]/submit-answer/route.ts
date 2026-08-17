import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendAdminPayoutNotification } from "@/lib/admin-notifications";
import {
  NOTIFICATION_TYPES,
  safeCreateUserNotification,
} from "@/lib/notifications";
import { validateUserContentLinks } from "@/lib/content-policy";
import { getUserMutationRestriction } from "@/lib/user-access";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }
  const restriction = await getUserMutationRestriction(user.id);
  if (restriction) {
    return NextResponse.json({ error: restriction }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    content?: string;
    noAiConfirmed?: boolean;
  };
  const content = body.content?.trim() ?? "";
  if (!content) {
    return NextResponse.json({ error: "回答本文を入力してください" }, { status: 400 });
  }
  if (!body.noAiConfirmed) {
    return NextResponse.json(
      { error: "AIを使用していないことへの確認が必要です" },
      { status: 400 }
    );
  }
  const contentPolicy = validateUserContentLinks(content);
  if (!contentPolicy.ok) {
    return NextResponse.json({ error: contentPolicy.message }, { status: 400 });
  }

  const negotiation = await prisma.negotiation.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      answerDueAt: true,
      proposedAmount: true,
      questionId: true,
      answer: {
        select: {
          id: true,
          userId: true,
          user: {
            select: { username: true, email: true, stripeAccountId: true },
          },
        },
      },
      question: { select: { title: true, userId: true, isClosed: true } },
    },
  });
  if (!negotiation || negotiation.answer.userId !== user.id) {
    return NextResponse.json({ error: "交渉が見つかりません" }, { status: 404 });
  }
  if (
    negotiation.status !== "ACCEPTED" ||
    negotiation.submittedAt ||
    !negotiation.answerDueAt ||
    negotiation.answerDueAt < new Date() ||
    negotiation.question.isClosed
  ) {
    return NextResponse.json(
      { error: "この交渉回答は投稿できない状態です" },
      { status: 403 }
    );
  }

  const purchase = await prisma.purchase.findUnique({
    where: { negotiationId: negotiation.id },
    select: { status: true, stripeChargeId: true, transferGroup: true },
  });
  if (!purchase || purchase.status !== "PAID") {
    return NextResponse.json(
      { error: "追加報酬の決済情報が見つかりません" },
      { status: 409 }
    );
  }

  const grossAmount = negotiation.proposedAmount;
  const platformFeeAmount = Math.floor(grossAmount * 0.1);
  const netAmount = grossAmount - platformFeeAmount;
  const submittedAt = new Date();
  const payout = await prisma.$transaction(async (tx) => {
    const submitted = await tx.negotiation.updateMany({
      where: {
        id,
        status: "ACCEPTED",
        submittedAt: null,
        answerDueAt: { gte: submittedAt },
      },
      data: { submittedAt },
    });
    if (submitted.count === 0) return null;

    await tx.answer.update({
      where: { id: negotiation.answer.id },
      data: { content },
    });
    const created = await tx.payout.create({
      data: {
        userId: user.id,
        questionId: negotiation.questionId,
        answerId: negotiation.answer.id,
        negotiationId: negotiation.id,
        kind: "negotiation_reward",
        description: "交渉追加報酬",
        grossAmount,
        platformFeeAmount,
        netAmount,
        amount: netAmount,
        currency: "jpy",
        status: "pending",
        stripeAccountId: negotiation.answer.user?.stripeAccountId ?? null,
        stripeChargeId: purchase.stripeChargeId,
        transferGroup: purchase.transferGroup,
      },
      select: { amount: true },
    });
    await tx.eventLog.create({
      data: {
        type: "negotiation_answer_submitted",
        payload: {
          negotiationId: id,
          questionId: negotiation.questionId,
          answerId: negotiation.answer.id,
          grossAmount,
          platformFeeAmount,
          netAmount,
        },
      },
    });
    return created;
  });

  if (!payout) {
    return NextResponse.json(
      { error: "この交渉回答はすでに処理されています" },
      { status: 409 }
    );
  }

  if (negotiation.question.userId) {
    await safeCreateUserNotification({
      userId: negotiation.question.userId,
      actorUserId: user.id,
      type: NOTIFICATION_TYPES.ANSWER_CREATED,
      message: `承認した追加報酬の回答が投稿されました: ${negotiation.question.title}`,
      url: `/questions/${negotiation.questionId}?from=notification`,
      data: { questionId: negotiation.questionId, answerId: negotiation.answer.id },
      context: "negotiation_answer_submitted",
    });
  }
  await safeCreateUserNotification({
    userId: user.id,
    type: NOTIFICATION_TYPES.PAYOUT_SCHEDULED,
    message: `交渉追加報酬${payout.amount.toLocaleString("ja-JP")}円をサービス内残高へ反映しました。`,
    url: "/mypage/rewards",
    data: { questionId: negotiation.questionId, answerId: negotiation.answer.id },
    dedupeKey: `payout-scheduled:negotiation:${negotiation.id}`,
    mandatoryEmail: true,
    context: "negotiation_reward_scheduled",
  });
  await sendAdminPayoutNotification({
    payoutType: "negotiation_reward",
    amount: payout.amount,
    recipientName: negotiation.answer.user?.username ?? undefined,
    recipientEmail: negotiation.answer.user?.email,
    questionId: negotiation.questionId,
    answerId: negotiation.answer.id,
    adminPath: "/admin/payouts",
  });

  return NextResponse.json({ ok: true, content, submittedAt });
}
