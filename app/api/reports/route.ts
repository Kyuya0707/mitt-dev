import { NextResponse } from "next/server";
import { ReportReason } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ALLOWED_REASONS = new Set<ReportReason>([
  "AI_CONTENT",
  "FINANCIAL_ADVICE",
  "FRAUD_FALSE",
  "HARASSMENT",
  "COPYRIGHT",
  "OTHER",
]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    targetType?: "question" | "answer" | "comment";
    targetId?: string;
    reason?: ReportReason;
    details?: string;
  };
  const details = body.details?.trim() ?? "";
  if (!body.targetType || !body.targetId || !body.reason) {
    return NextResponse.json({ error: "通報内容が不足しています" }, { status: 400 });
  }
  if (!ALLOWED_REASONS.has(body.reason)) {
    return NextResponse.json({ error: "通報理由を確認してください" }, { status: 400 });
  }
  if (details.length < 10 || details.length > 2000) {
    return NextResponse.json(
      { error: "具体的な状況を10文字以上2,000文字以内で入力してください" },
      { status: 400 }
    );
  }

  let targetOwnerId: string | null = null;
  const relationData: {
    questionId?: string;
    answerId?: string;
    commentId?: string;
  } = {};

  if (body.targetType === "question") {
    const target = await prisma.question.findFirst({
      where: {
        id: body.targetId,
        isPaid: true,
        cancellationRequests: { none: { status: "approved" } },
      },
      select: { id: true, userId: true },
    });
    targetOwnerId = target?.userId ?? null;
    if (target) relationData.questionId = target.id;
  } else if (body.targetType === "answer") {
    const target = await prisma.answer.findFirst({
      where: {
        id: body.targetId,
        question: {
          isPaid: true,
          cancellationRequests: { none: { status: "approved" } },
        },
      },
      select: { id: true, userId: true },
    });
    targetOwnerId = target?.userId ?? null;
    if (target) relationData.answerId = target.id;
  } else {
    const target = await prisma.comment.findFirst({
      where: {
        id: body.targetId,
        answer: {
          question: {
            isPaid: true,
            cancellationRequests: { none: { status: "approved" } },
          },
        },
      },
      select: { id: true, userId: true },
    });
    targetOwnerId = target?.userId ?? null;
    if (target) relationData.commentId = target.id;
  }

  if (!targetOwnerId) {
    return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
  }
  if (targetOwnerId === user.id) {
    return NextResponse.json({ error: "自分の投稿は通報できません" }, { status: 403 });
  }

  const duplicate = await prisma.report.findFirst({
    where: {
      reporterId: user.id,
      status: "PENDING",
      ...relationData,
    },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "この投稿はすでに確認依頼中です" },
      { status: 409 }
    );
  }

  const report = await prisma.report.create({
    data: {
      reporterId: user.id,
      targetOwnerId,
      reason: body.reason,
      details,
      ...relationData,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, reportId: report.id });
}
