import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getQuestionRewardBreakdown } from "@/lib/reward-breakdown";
import {
  sendAdminCancellationRequestNotification,
  sendCancellationRequestReceivedEmail,
} from "@/lib/cancellation-notifications";
import { getSafeErrorMessage } from "@/lib/safe-error";
import { getQuestionCancelAvailableAt } from "@/lib/question-deadline";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      reason?: string | null;
    };

    const question = await prisma.question.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        userId: true,
        rewardAmount: true,
        createdAt: true,
        answerDeadline: true,
        bestAnswerId: true,
        answers: {
          select: { id: true },
        },
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: "質問が見つかりません" },
        { status: 404 }
      );
    }

    if (question.userId !== user.id) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const availableAt = getQuestionCancelAvailableAt({
      createdAt: question.createdAt,
      answerDeadline: question.answerDeadline,
    });

    if (availableAt > new Date()) {
      return NextResponse.json(
        {
          error: question.answerDeadline
            ? "キャンセル申請は回答期限を過ぎてから可能です"
            : "キャンセル申請は投稿から2週間後に可能です",
        },
        { status: 403 }
      );
    }

    if (question.bestAnswerId) {
      return NextResponse.json(
        { error: "BEST回答選定後はキャンセル申請できません" },
        { status: 403 }
      );
    }

    const existingPending = await prisma.cancellationRequest.findFirst({
      where: {
        questionId: id,
        status: "pending",
      },
      select: { id: true },
    });

    if (existingPending) {
      return NextResponse.json(
        { error: "この質問はすでにキャンセル申請中です" },
        { status: 409 }
      );
    }

    const existingApproved = await prisma.cancellationRequest.findFirst({
      where: {
        questionId: id,
        status: "approved",
      },
      select: { id: true },
    });

    if (existingApproved) {
      return NextResponse.json(
        { error: "この質問はすでにキャンセル済みです" },
        { status: 409 }
      );
    }

    const requestRecord = await prisma.cancellationRequest.create({
      data: {
        questionId: id,
        requesterUserId: user.id,
        reason: body.reason?.trim() || null,
      },
      select: {
        id: true,
        reason: true,
      },
    });

    const rewardBreakdown = getQuestionRewardBreakdown(question.rewardAmount);
    const requesterProfile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        username: true,
        email: true,
      },
    });

    const requesterName =
      requesterProfile?.username || requesterProfile?.email || user.id;

    void sendAdminCancellationRequestNotification({
      questionId: question.id,
      questionTitle: question.title,
      requesterName,
      rewardAmount: question.rewardAmount,
      checkoutAmount: rewardBreakdown.checkoutAmount,
      answerCount: question.answers.length,
      reason: requestRecord.reason,
    });

    if (requesterProfile?.email) {
      void sendCancellationRequestReceivedEmail({
        to: requesterProfile.email,
        questionId: question.id,
        questionTitle: question.title,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "キャンセル申請を受け付けました。",
      requestId: requestRecord.id,
    });
  } catch (error) {
    console.error("Question cancellation request error:", {
      message: getSafeErrorMessage(error),
    });
    return NextResponse.json(
      { error: "キャンセル申請の作成に失敗しました" },
      { status: 500 }
    );
  }
}
