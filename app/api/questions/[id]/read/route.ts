import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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

    // ✅ 質問者本人だけ許可
    const q = await prisma.question.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!q || q.userId !== user.id) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const answers = await prisma.answer.findMany({
      where: { questionId: id },
      select: { id: true },
    });

    const now = new Date();

    await Promise.all(
      answers.map((a) =>
        prisma.answerRead.upsert({
          where: { userId_answerId: { userId: user.id, answerId: a.id } },
          update: { readAt: now },
          create: { userId: user.id, answerId: a.id, readAt: now },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("question read error:", e);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
