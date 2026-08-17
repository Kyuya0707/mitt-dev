import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserAdminStatus } from "@/lib/admin";
import {
  NOTIFICATION_TYPES,
  safeCreateUserNotification,
} from "@/lib/notifications";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, canManageOperations } = await getCurrentUserAdminStatus();
  if (!user) return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  if (!canManageOperations) return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: "uphold" | "overturn";
    reviewNote?: string;
  };
  const reviewNote = body.reviewNote?.trim() ?? "";
  if (!body.action || reviewNote.length < 5) {
    return NextResponse.json({ error: "審査結果と5文字以上のメモが必要です" }, { status: 400 });
  }

  const appeal = await prisma.appeal.findUnique({
    where: { id },
    select: { id: true, status: true, userId: true, sanctionId: true },
  });
  if (!appeal) return NextResponse.json({ error: "異議申立てが見つかりません" }, { status: 404 });
  if (appeal.status !== "PENDING") {
    return NextResponse.json({ error: "審査済みです" }, { status: 409 });
  }

  const overturned = body.action === "overturn";
  await prisma.$transaction(async (tx) => {
    await tx.appeal.update({
      where: { id },
      data: {
        status: overturned ? "OVERTURNED" : "UPHELD",
        reviewedAt: new Date(),
        reviewedById: user.id,
        reviewNote,
      },
    });
    if (overturned) {
      await tx.sanction.update({
        where: { id: appeal.sanctionId },
        data: { revokedAt: new Date() },
      });
      const remaining = await tx.sanction.findMany({
        where: { targetUserId: appeal.userId, revokedAt: null },
        orderBy: { createdAt: "desc" },
        select: { type: true, endsAt: true },
      });
      const permanent = remaining.some((sanction) => sanction.type === "PERMANENT");
      const futureEnds = remaining
        .map((sanction) => sanction.endsAt)
        .filter((value): value is Date => !!value && value > new Date())
        .sort((a, b) => b.getTime() - a.getTime());
      await tx.user.update({
        where: { id: appeal.userId },
        data: {
          permanentlySuspendedAt: permanent ? new Date() : null,
          suspendedUntil: futureEnds[0] ?? null,
        },
      });
    }
    await tx.eventLog.create({
      data: {
        type: "appeal_reviewed",
        payload: {
          appealId: id,
          sanctionId: appeal.sanctionId,
          result: overturned ? "OVERTURNED" : "UPHELD",
          reviewedById: user.id,
        },
      },
    });
  });

  await safeCreateUserNotification({
    userId: appeal.userId,
    type: NOTIFICATION_TYPES.APPEAL_RESULT,
    message: overturned
      ? "異議申立てが認められ、対象の措置を取り消しました。"
      : "異議申立てを審査した結果、対象の措置を維持します。",
    url: "/mypage/appeals",
    data: {},
    dedupeKey: `appeal-result:${appeal.id}`,
    mandatoryEmail: true,
    context: "appeal_result",
  });

  return NextResponse.json({ ok: true });
}
