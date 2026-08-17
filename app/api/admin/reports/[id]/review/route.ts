import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserAdminStatus } from "@/lib/admin";
import {
  NOTIFICATION_TYPES,
  safeCreateUserNotification,
} from "@/lib/notifications";
import { refundBestViewPurchasesForViolatedAnswer } from "@/lib/best-view-violation-refund";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, canManageOperations } = await getCurrentUserAdminStatus();
  if (!user) return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  if (!canManageOperations) return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: "confirm" | "dismiss";
    resolutionNote?: string;
    majorViolation?: boolean;
  };
  const resolutionNote = body.resolutionNote?.trim() ?? "";
  if (!body.action || resolutionNote.length < 5) {
    return NextResponse.json(
      { error: "審査結果と5文字以上の運営メモが必要です" },
      { status: 400 }
    );
  }

  const report = await prisma.report.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      reason: true,
      targetOwnerId: true,
      questionId: true,
      answerId: true,
      commentId: true,
      targetOwner: {
        select: { suspendedUntil: true, permanentlySuspendedAt: true },
      },
    },
  });
  if (!report) return NextResponse.json({ error: "通報が見つかりません" }, { status: 404 });
  if (report.status !== "PENDING") {
    return NextResponse.json({ error: "この通報は審査済みです" }, { status: 409 });
  }

  if (body.action === "dismiss") {
    await prisma.$transaction([
      prisma.report.update({
        where: { id },
        data: {
          status: "DISMISSED",
          reviewedAt: new Date(),
          reviewedById: user.id,
          resolutionNote,
        },
      }),
      prisma.eventLog.create({
        data: {
          type: "report_dismissed",
          payload: { reportId: id, reviewedById: user.id, resolutionNote },
        },
      }),
    ]);
    return NextResponse.json({ ok: true, status: "DISMISSED" });
  }

  const priorSanctionCount = await prisma.sanction.count({
    where: { targetUserId: report.targetOwnerId, revokedAt: null },
  });
  const sanctionType = body.majorViolation
    ? "PERMANENT"
    : priorSanctionCount === 0
      ? "WARNING"
      : priorSanctionCount === 1
        ? "SUSPEND_7_DAYS"
        : priorSanctionCount === 2
          ? "SUSPEND_30_DAYS"
          : "PERMANENT";
  const startsAt = new Date();
  const endsAt =
    sanctionType === "SUSPEND_7_DAYS"
      ? new Date(startsAt.getTime() + 7 * DAY_MS)
      : sanctionType === "SUSPEND_30_DAYS"
        ? new Date(startsAt.getTime() + 30 * DAY_MS)
        : null;

  const sanction = await prisma.$transaction(async (tx) => {
    await tx.report.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        reviewedAt: startsAt,
        reviewedById: user.id,
        resolutionNote,
      },
    });
    const created = await tx.sanction.create({
      data: {
        type: sanctionType,
        reason: resolutionNote,
        startsAt,
        endsAt,
        targetUserId: report.targetOwnerId,
        reviewedById: user.id,
        sourceReportId: report.id,
      },
    });
    await tx.user.update({
      where: { id: report.targetOwnerId },
      data:
        sanctionType === "PERMANENT"
          ? { permanentlySuspendedAt: startsAt }
          : endsAt
            ? { suspendedUntil: endsAt }
            : {},
    });
    await tx.eventLog.create({
      data: {
        type: "report_confirmed_sanction",
        payload: {
          reportId: id,
          sanctionId: created.id,
          sanctionType,
          reviewedById: user.id,
          questionId: report.questionId,
          answerId: report.answerId,
          commentId: report.commentId,
        },
      },
    });
    return created;
  });

  await safeCreateUserNotification({
    userId: report.targetOwnerId,
    type: NOTIFICATION_TYPES.REPORT_CONFIRMED,
    message: `運営確認の結果、投稿の規約違反を確認しました。措置: ${sanctionType}。マイページから異議申立てができます。`,
    url: "/mypage/appeals",
    data: {},
    dedupeKey: `report-confirmed:${report.id}`,
    mandatoryEmail: true,
    context: "report_confirmed",
  });

  const bestViewRefunds = report.answerId
    ? await refundBestViewPurchasesForViolatedAnswer({
        answerId: report.answerId,
        reportId: report.id,
        reviewedById: user.id,
      })
    : { refundedCount: 0, failedCount: 0 };

  return NextResponse.json({ ok: true, status: "CONFIRMED", sanction, bestViewRefunds });
}
