import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserAdminStatus } from "@/lib/admin";

export async function GET() {
  const { user, canManageOperations } = await getCurrentUserAdminStatus();
  if (!user) return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  if (!canManageOperations) return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const [reports, appeals] = await Promise.all([
    prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        createdAt: true,
        reason: true,
        details: true,
        status: true,
        questionId: true,
        answerId: true,
        commentId: true,
        resolutionNote: true,
        targetOwner: { select: { id: true, username: true } },
        sanction: { select: { id: true, type: true, endsAt: true } },
      },
    }),
    prisma.appeal.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true,
        createdAt: true,
        evidence: true,
        user: { select: { id: true, username: true } },
        sanction: { select: { id: true, type: true, reason: true } },
      },
    }),
  ]);
  return NextResponse.json({ reports, appeals });
}
