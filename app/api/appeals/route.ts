import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "ログインしてください" }, { status: 401 });

  const sanctions = await prisma.sanction.findMany({
    where: { targetUserId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      type: true,
      reason: true,
      endsAt: true,
      revokedAt: true,
      appeals: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          evidence: true,
          status: true,
          reviewNote: true,
        },
      },
    },
  });
  return NextResponse.json({ sanctions });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "ログインしてください" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    sanctionId?: string;
    evidence?: string;
  };
  const evidence = body.evidence?.trim() ?? "";
  if (!body.sanctionId || evidence.length < 30 || evidence.length > 5000) {
    return NextResponse.json(
      { error: "新しい証拠または説明を30文字以上5,000文字以内で入力してください" },
      { status: 400 }
    );
  }

  const sanction = await prisma.sanction.findFirst({
    where: { id: body.sanctionId, targetUserId: user.id, revokedAt: null },
    select: {
      id: true,
      appeals: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { createdAt: true, evidence: true },
      },
    },
  });
  if (!sanction) return NextResponse.json({ error: "措置が見つかりません" }, { status: 404 });

  const latest = sanction.appeals[0];
  if (latest && Date.now() - latest.createdAt.getTime() < SEVEN_DAYS_MS) {
    return NextResponse.json(
      { error: "次の異議申立ては前回から7日後に可能です" },
      { status: 429 }
    );
  }
  if (
    sanction.appeals.some(
      (appeal) => appeal.evidence.trim().toLowerCase() === evidence.toLowerCase()
    )
  ) {
    return NextResponse.json(
      { error: "前回と異なる新しい証拠または説明が必要です" },
      { status: 400 }
    );
  }

  const appeal = await prisma.appeal.create({
    data: { sanctionId: sanction.id, userId: user.id, evidence },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, appealId: appeal.id });
}
