import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  NOTIFICATION_TYPES,
  safeCreateUserNotification,
} from "@/lib/notifications";
import { sendAdminPayoutNotification } from "@/lib/admin-notifications";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "ログインが必要です" },
        { status: 401 }
      );
    }

    const { answerId, questionId } = await req.json();
    if (!answerId || !questionId) {
      return NextResponse.json(
        { error: "必要な情報が不足しています" },
        { status: 400 }
      );
    }

    // 質問を取得して質問者本人かチェック（bestAnswerId / isClosedも見る）
    const q = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        userId: true,
        bestAnswerId: true,
        isClosed: true,
        title: true,
        rewardAmount: true,
      },
    });

    if (!q || q.userId !== user.id) {
      return NextResponse.json(
        { error: "権限がありません" },
        { status: 403 }
      );
    }

    // ✅ すでに締め切り or BEST済みなら弾く（安全）
    if (q.isClosed || q.bestAnswerId) {
      return NextResponse.json(
        { error: "この質問ではすでにBEST回答が確定しています" },
        { status: 409 }
      );
    }

    // ✅ Answerがその質問に属しているかチェック
    const answer = await prisma.answer.findUnique({
      where: { id: answerId },
      select: {
        id: true,
        userId: true,
        questionId: true,
        user: {
          select: {
            stripeAccountId: true,
          },
        },
      },
    });

    if (!answer || !answer.userId) {
      return NextResponse.json(
        { error: "回答データが見つかりません" },
        { status: 404 }
      );
    }

    if (answer.questionId !== questionId) {
      return NextResponse.json(
        { error: "この質問に紐づく回答ではありません" },
        { status: 400 }
      );
    }

    const answerUserId = answer.userId;

    const payoutRecipient = await prisma.user.findUnique({
      where: { id: answerUserId },
      select: {
        username: true,
        email: true,
      },
    });

    if (!payoutRecipient) {
      return NextResponse.json(
        { error: "回答者情報が見つかりません" },
        { status: 404 }
      );
    }

    const grossAmount = q.rewardAmount;
    const platformFeeAmount = Math.floor(grossAmount * 0.1);
    const netAmount = grossAmount - platformFeeAmount;

    const createdPayout = await prisma.$transaction(async (tx) => {
      await tx.question.update({
        where: { id: questionId },
        data: {
          bestAnswerId: answerId,
          isClosed: true,
        },
      });

      const existingPayout = await tx.payout.findUnique({
        where: { answerId: answer.id },
        select: { id: true },
      });

      if (!existingPayout) {
        await tx.payout.create({
          data: {
            userId: answerUserId,
            questionId,
            answerId: answer.id,
            grossAmount,
            platformFeeAmount,
            netAmount,
            amount: netAmount,
            currency: "jpy",
            status: "pending",
            stripeAccountId: answer.user?.stripeAccountId ?? null,
          },
        });
        return {
          amount: netAmount,
          questionId,
          answerId: answer.id,
          user: {
            username: payoutRecipient.username,
            email: payoutRecipient.email,
          },
        };
      }
      return null;
    });

    await safeCreateUserNotification({
      userId: answerUserId,
      actorUserId: user.id,
      type: NOTIFICATION_TYPES.BEST_SELECTED,
      message: `あなたの回答がBESTに選ばれました: ${q.title}`,
      url: `/questions/${questionId}?from=notification`,
      data: {
        questionId,
        answerId,
      },
      context: "best_selected",
    });

    if (createdPayout) {
      await sendAdminPayoutNotification({
        payoutType: "question_reward",
        amount: createdPayout.amount,
        recipientName: createdPayout.user.username ?? undefined,
        recipientEmail: createdPayout.user.email,
        questionId: createdPayout.questionId ?? questionId,
        answerId: createdPayout.answerId ?? answerId,
        adminPath: "/admin/payouts",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("BEST設定エラー:", error);
    return NextResponse.json(
      { error: "予期しないエラーが発生しました" },
      { status: 500 }
    );
  }
}
