import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const { answerId, questionId } = await req.json();
    if (!answerId || !questionId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // 質問を取得して質問者本人かチェック（bestAnswerId / isClosedも見る）
    const q = await prisma.question.findUnique({
      where: { id: questionId },
      select: { userId: true, bestAnswerId: true, isClosed: true },
    });

    if (!q || q.userId !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // ✅ すでに締め切り or BEST済みなら弾く（安全）
    if (q.isClosed || q.bestAnswerId) {
      return NextResponse.json(
        { error: "Already closed or best already selected" },
        { status: 409 }
      );
    }

    // ✅ Answerがその質問に属しているかチェック
    const answer = await prisma.answer.findUnique({
      where: { id: answerId },
      select: { userId: true, questionId: true },
    });

    if (!answer || !answer.userId) {
      return NextResponse.json(
        { error: "Answer or answer.userId not found" },
        { status: 404 }
      );
    }

    if (answer.questionId !== questionId) {
      return NextResponse.json(
        { error: "Answer does not belong to this question" },
        { status: 400 }
      );
    }

    // ✅ トランザクションでBEST更新 + 通知作成を一括
    await prisma.$transaction([
      prisma.question.update({
        where: { id: questionId },
        data: {
          bestAnswerId: answerId,
          isClosed: true,
        },
      }),
      prisma.notification.create({
        data: {
          userId: answer.userId,
          type: "BEST_SELECTED",
          message: "あなたの回答がBESTに選ばれました！",
          url: `/questions/${questionId}`,
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("BEST設定エラー:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
