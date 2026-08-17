import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  NOTIFICATION_TYPES,
  safeCreateUserNotification,
} from "@/lib/notifications";
import { getSafeErrorMessage } from "@/lib/safe-error";
import { publicUserSelect } from "@/lib/public-user-select";
import { validateUserContentLinks } from "@/lib/content-policy";
import { getUserMutationRestriction } from "@/lib/user-access";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { content, answerId } = body;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "ログインが必要です" },
        { status: 401 }
      );
    }
    const restriction = await getUserMutationRestriction(user.id);
    if (restriction) {
      return NextResponse.json({ error: restriction }, { status: 403 });
    }

    if (
      typeof content !== "string" ||
      content.trim().length === 0 ||
      typeof answerId !== "string" ||
      answerId.length === 0
    ) {
      return NextResponse.json(
        { error: "入力内容を確認してください" },
        { status: 400 }
      );
    }
    const contentPolicy = validateUserContentLinks(content);
    if (!contentPolicy.ok) {
      return NextResponse.json({ error: contentPolicy.message }, { status: 400 });
    }

    const answer = await prisma.answer.findUnique({
      where: { id: answerId },
      select: {
        id: true,
        questionId: true,
        userId: true,
        question: {
          select: {
            title: true,
            userId: true,
            isPaid: true,
            cancellationRequests: {
              where: { status: "approved" },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!answer || !answer.question) {
      return NextResponse.json(
        { error: "回答が見つかりません" },
        { status: 404 }
      );
    }

    if (
      !answer.question.isPaid ||
      answer.question.cancellationRequests.length > 0
    ) {
      return NextResponse.json(
        { error: "回答が見つかりません" },
        { status: 404 }
      );
    }

    const canComment =
      user.id === answer.userId || user.id === answer.question.userId;

    if (!canComment) {
      return NextResponse.json(
        { error: "権限がありません" },
        { status: 403 }
      );
    }

    const newComment = await prisma.comment.create({
      data: {
        content: content.trim(),
        answerId,
        userId: user.id,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: {
          select: publicUserSelect,
        },
      },
    });

    if (answer.userId) {
      await safeCreateUserNotification({
        userId: answer.userId,
        actorUserId: user.id,
        type: NOTIFICATION_TYPES.COMMENT_CREATED,
        message: `あなたの回答にコメントがつきました: ${answer.question.title}`,
        url: `/questions/${answer.questionId}?from=notification`,
        data: {
          questionId: answer.questionId,
          answerId: answer.id,
          commentId: newComment.id,
        },
        context: "comment_created",
      });
    }

    return NextResponse.json(newComment);
  } catch (error) {
    console.error("コメント追加エラー:", {
      message: getSafeErrorMessage(error),
    });
    return NextResponse.json(
      { error: "予期しないエラーが発生しました" },
      { status: 500 }
    );
  }
}
