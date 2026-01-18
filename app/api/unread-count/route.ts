// app/api/unread-count/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ count: 0 });

  // ① 未読回答（自分の質問に来た回答で、AnswerReadが無いもの）
  const unreadAnswersCount = await prisma.answer.count({
    where: {
      question: { userId: user.id },
      NOT: {
        reads: {
          some: { userId: user.id },
        },
      },
    },
  });

  // ② 未読通知（BESTなど：Notification.readAt が null）
  const unreadNotificationsCount = await prisma.notification.count({
    where: {
      userId: user.id,
      readAt: null,
    },
  });

  return NextResponse.json({
    count: unreadAnswersCount + unreadNotificationsCount,
  });
}

export const dynamic = "force-dynamic";
