import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { validateUserContentLinks } from "@/lib/content-policy";
import { getUserMutationRestriction } from "@/lib/user-access";

async function getEditableAnswer(answerId: string, userId: string) {
  return prisma.answer.findUnique({
    where: { id: answerId },
    select: {
      id: true,
      userId: true,
      questionId: true,
      negotiation: { select: { id: true, status: true } },
      question: {
        select: {
          bestAnswerId: true,
          isPaid: true,
          cancellationRequests: {
            where: { status: "approved" },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  }).then((answer) => {
    if (!answer || answer.userId !== userId) {
      return null;
    }
    return answer;
  });
}

export async function PATCH(
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
  const answer = await getEditableAnswer(id, user.id);
  if (!answer) {
    return NextResponse.json({ error: "回答が見つかりません" }, { status: 404 });
  }
  if (
    answer.question.bestAnswerId ||
    !answer.question.isPaid ||
    answer.question.cancellationRequests.length > 0
  ) {
    return NextResponse.json(
      { error: "BEST選択後または非公開の回答は編集できません" },
      { status: 403 }
    );
  }

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

  const updated = await prisma.answer.update({
    where: { id },
    data: { content },
    select: { id: true, content: true },
  });
  await prisma.eventLog.create({
    data: {
      type: "answer_edited",
      payload: { answerId: id, questionId: answer.questionId, userId: user.id },
    },
  });

  return NextResponse.json({ ok: true, answer: updated });
}

export async function DELETE(
  _request: Request,
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
  const answer = await getEditableAnswer(id, user.id);
  if (!answer) {
    return NextResponse.json({ error: "回答が見つかりません" }, { status: 404 });
  }
  if (
    answer.question.bestAnswerId ||
    !answer.question.isPaid ||
    answer.question.cancellationRequests.length > 0
  ) {
    return NextResponse.json(
      { error: "BEST選択後または非公開の回答は削除できません" },
      { status: 403 }
    );
  }
  if (answer.negotiation?.status === "ACCEPTED") {
    return NextResponse.json(
      { error: "追加決済済みの回答は削除できません。運営へお問い合わせください" },
      { status: 403 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.answerLike.deleteMany({ where: { answerId: id } });
    await tx.answerRead.deleteMany({ where: { answerId: id } });
    await tx.comment.deleteMany({ where: { answerId: id } });
    await tx.answerImage.deleteMany({ where: { answerId: id } });
    await tx.report.deleteMany({ where: { answerId: id } });
    if (answer.negotiation) {
      await tx.negotiation.delete({ where: { id: answer.negotiation.id } });
    }
    await tx.answer.delete({ where: { id } });
    await tx.eventLog.create({
      data: {
        type: "answer_deleted",
        payload: { answerId: id, questionId: answer.questionId, userId: user.id },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
