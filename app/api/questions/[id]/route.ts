// app/api/questions/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { QuestionAnswer } from "@/app/(app)/questions/[id]/types";
import { validateViewerPrice } from "@/lib/viewer-price";
import { getSafeErrorMessage } from "@/lib/safe-error";
import { parseAnswerDeadlineInput } from "@/lib/question-deadline";

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

    const hasPurchasedBestAnswer =
      !!authUser
        ? (await prisma.purchase.findFirst({
            where: {
              userId: authUser.id,
              questionId: question.id,
              status: "PAID",
            },
            select: { id: true },
          })) !== null
        : false;
    const answersWithLock: QuestionAnswer[] = question.answers.map((answer) => {
      const isBestAnswer = answer.id === question.bestAnswerId;
      const canViewThisAnswer =
        !isBestAnswer ||
        isAuthor ||
        (!!authUser && answer.userId === authUser.id) ||
        hasPurchasedBestAnswer;
      const isLockedBest = isBestAnswer && !canViewThisAnswer;

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
    console.error("❌ GET /questions/[id] Error:", {
      message: getSafeErrorMessage(error),
    });
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
    }

    const question = await prisma.question.findUnique({
      where: { id },
      select: { userId: true, isClosed: true },
    });

    if (!question) {
      return NextResponse.json(
        { error: "質問が見つかりません" },
        { status: 404 }
      );
    }

    if (question.userId !== authUser.id) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    if (question.isClosed) {
      return NextResponse.json(
        { error: "クローズ済みの質問は変更できません" },
        { status: 400 }
      );
    }

    const hasViewerPrice = body.viewerPrice !== undefined;
    const hasAnswerDeadline = body.answerDeadline !== undefined;

    if (!hasViewerPrice && !hasAnswerDeadline) {
      return NextResponse.json(
        { error: "更新内容がありません" },
        { status: 400 }
      );
    }

    const viewerPriceValidation = hasViewerPrice
      ? validateViewerPrice(body.viewerPrice)
      : null;

    if (viewerPriceValidation && !viewerPriceValidation.ok) {
      return NextResponse.json(
        { error: viewerPriceValidation.message },
        { status: 400 }
      );
    }

    const answerDeadlineValidation = hasAnswerDeadline
      ? parseAnswerDeadlineInput(body.answerDeadline)
      : null;

    if (answerDeadlineValidation && !answerDeadlineValidation.ok) {
      return NextResponse.json(
        { error: answerDeadlineValidation.message },
        { status: 400 }
      );
    }

    const updated = await prisma.question.update({
      where: { id },
      data: {
        ...(hasViewerPrice
          ? { viewerPrice: viewerPriceValidation?.value ?? null }
          : {}),
        ...(hasAnswerDeadline
          ? { answerDeadline: answerDeadlineValidation?.value ?? null }
          : {}),
      },
      select: { id: true, viewerPrice: true, answerDeadline: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("❌ PATCH /questions/[id] Error:", {
      message: getSafeErrorMessage(error),
    });
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}
