import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { NOTIFICATION_TYPES, createUserNotification } from "@/lib/notifications";

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
      include: {
        user: true, // コメントしたユーザー情報も返す
      },
    });

    if (answer.userId) {
      await createUserNotification({
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
      });
    }

    return NextResponse.json(newComment);
  } catch (error) {
    console.error("コメント追加エラー:", error);
    return NextResponse.json(
      { error: "予期しないエラーが発生しました" },
      { status: 500 }
    );
  }
}
