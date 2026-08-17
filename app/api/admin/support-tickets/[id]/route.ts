import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserAdminStatus } from "@/lib/admin";

const STATUSES = new Set(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, canManageOperations } = await getCurrentUserAdminStatus();
  if (!user) return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  if (!canManageOperations) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { status?: string; adminNote?: string };
  if (!body.status || !STATUSES.has(body.status)) {
    return NextResponse.json({ error: "対応状態を確認してください" }, { status: 400 });
  }
  const { id } = await params;
  const ticket = await prisma.supportTicket.update({
    where: { id },
    data: { status: body.status, adminNote: body.adminNote?.trim().slice(0, 5000), assignedToId: user.id },
  });
  await prisma.eventLog.create({
    data: { type: "support_ticket_updated", payload: { ticketId: id, status: body.status, administeredById: user.id } },
  });
  return NextResponse.json({ ok: true, ticket });
}
