import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserAdminStatus } from "@/lib/admin";

export async function GET() {
  const { user, canManageOperations } = await getCurrentUserAdminStatus();
  if (!user) return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  if (!canManageOperations) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  const tickets = await prisma.supportTicket.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { requester: { select: { username: true, email: true } } },
  });
  return NextResponse.json({ tickets });
}
