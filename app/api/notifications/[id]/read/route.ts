import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true, readAt: true },
    });

    // ✅ 存在しない or 他人の通知は 404（情報漏えいを抑える）
    if (!notification || notification.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // ✅ すでに既読ならそのまま成功（冪等）
    if (notification.readAt) {
      return NextResponse.json({ success: true });
    }

    await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Notification read error:", e);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
