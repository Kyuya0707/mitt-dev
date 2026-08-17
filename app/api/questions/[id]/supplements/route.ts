import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
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
  if (!content || content.length > 5000) {
    return NextResponse.json(
      { error: "補足は1文字以上5,000文字以内で入力してください" },
      { status: 400 }
    );
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

  const question = await prisma.question.findFirst({
    where: {
      id,
      isPaid: true,
      cancellationRequests: { none: { status: "approved" } },
    },
    select: {
      id: true,
      title: true,
      userId: true,
      answers: {
        where: { userId: { not: null } },
        select: { userId: true },
      },
    },
  });
  if (!question) {
    return NextResponse.json({ error: "質問が見つかりません" }, { status: 404 });
  }
  if (question.userId !== user.id) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const supplement = await prisma.questionSupplement.create({
    data: { questionId: id, authorId: user.id, content },
    select: { id: true, content: true, createdAt: true },
  });

  const recipientIds = [
    ...new Set(
      question.answers
        .map((answer) => answer.userId)
        .filter((userId): userId is string => !!userId && userId !== user.id)
    ),
  ];
  for (const recipientId of recipientIds) {
    await safeCreateUserNotification({
      userId: recipientId,
      actorUserId: user.id,
      type: NOTIFICATION_TYPES.QUESTION_SUPPLEMENT,
      message: `回答した質問「${question.title}」に補足が追加されました。`,
      url: `/questions/${question.id}`,
      data: { questionId: question.id },
      context: "question_supplement_created",
    });
  }

  return NextResponse.json({ ok: true, supplement });
}
