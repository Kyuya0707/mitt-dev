import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ count: 0 });
  }

  // ① 全回答を取得
  const allAnswers = await prisma.answer.findMany({
    select: { id: true },
  });

  const allAnswerIds = allAnswers.map(a => a.id);

  // ② 既読 AnswerRead を取得（ユーザーごと）
  const readRecords = await prisma.answerRead.findMany({
    where: { userId: user.id },
    select: { answerId: true },
  });

  const readIds = new Set(readRecords.map(r => r.answerId));

  // ③ 未読の answerId を抽出
  const unreadCount = allAnswerIds.filter(id => !readIds.has(id)).length;

  return NextResponse.json({ count: unreadCount });
}
