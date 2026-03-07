// app/api/questions/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { QuestionAnswer } from "@/app/(app)/questions/[id]/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const authUser = await getCurrentUser();

    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        category: true,
        user: true,
        images: true,
        answers: {
          include: {
            user: true,
            images: true,
            comments: {
              include: { user: true },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: "質問が見つかりません" },
        { status: 404 }
      );
    }

    const isAuthor = authUser?.id === question.userId;
    if (!question.isPaid && !isAuthor) {
      return NextResponse.json(
        { error: "この質問はまだ公開されていません" },
        { status: 403 }
      );
    }

    const hasPurchasedBestAnswer = false;
    const canViewBestAnswer = isAuthor || hasPurchasedBestAnswer;

    const answersWithLock: QuestionAnswer[] = question.answers.map((answer) => {
      const isLockedBest =
        answer.id === question.bestAnswerId && !canViewBestAnswer;

      if (isLockedBest) {
        return {
          ...answer,
          reads: [],
          content: null,
          images: [],
          comments: null,
          locked: true,
          negotiation: null,
        };
      }

      return {
        ...answer,
        reads: [],
        locked: false,
        negotiation: null,
      };
    });

    return NextResponse.json({
      ...question,
      answers: answersWithLock,
    });
  } catch (error) {
    console.error("❌ GET /questions/[id] Error:", error);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}
