// app/api/ranking/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const getFromDate = (range: string) => {
  const now = new Date();
  if (range === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (range === "month") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  }
  return null; // all
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const range = url.searchParams.get("range") ?? "week"; // week | month | all
  const from = getFromDate(range);

  // BESTが付いてるQuestionだけ集計
  const whereQuestion: any = { NOT: [{ bestAnswerId: null }] };
  if (from) whereQuestion.createdAt = { gte: from };

  const questions = await prisma.question.findMany({
    where: whereQuestion,
    select: { bestAnswerId: true },
  });

  const bestAnswerIds = questions
    .map((q) => q.bestAnswerId)
    .filter((v): v is string => !!v);

  if (bestAnswerIds.length === 0) {
    return NextResponse.json({ range, rows: [] });
  }

  // BEST AnswerのuserIdを集計
  const bestAnswers = await prisma.answer.findMany({
    where: { id: { in: bestAnswerIds }, userId: { not: null } },
    select: { userId: true },
  });

  const countMap = new Map<string, number>();
  for (const a of bestAnswers) {
    if (!a.userId) continue;
    countMap.set(a.userId, (countMap.get(a.userId) ?? 0) + 1);
  }

  const sorted = [...countMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50);

  const userIds = sorted.map(([userId]) => userId);

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, trustScore: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  const rows = sorted.map(([userId, bestCount], idx) => ({
    rank: idx + 1,
    userId,
    displayName: userMap.get(userId)?.name ?? "ユーザー",
    trustScore: userMap.get(userId)?.trustScore ?? 50,
    bestCount,
  }));

  return NextResponse.json({ range, rows });
}