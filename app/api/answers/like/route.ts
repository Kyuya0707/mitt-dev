import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { supabaseServer } from "@/lib/supabase-server";
import { getSafeErrorMessage } from "@/lib/safe-error";

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "ログインしてください" },
        { status: 401 }
      );
    }

    const { answerId } = await req.json();

    if (!answerId) {
      return NextResponse.json(
        { error: "answerId がありません" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const answer = await tx.answer.findUnique({
        where: { id: answerId },
        select: { id: true },
      });

      if (!answer) {
        return { ok: false as const, status: 404, error: "回答が見つかりません" };
      }

      const existing = await tx.answerLike.findUnique({
        where: {
          userId_answerId: {
            userId: user.id,
            answerId,
          },
        },
      });

      if (!existing) {
        await tx.answerLike.create({
          data: {
            userId: user.id,
            answerId,
          },
        });
      } else {
        await tx.answerLike.delete({
          where: {
            userId_answerId: {
              userId: user.id,
              answerId,
            },
          },
        });
      }

      const likeCount = await tx.answerLike.count({
        where: { answerId },
      });

      await tx.answer.update({
        where: { id: answerId },
        data: { likeCount },
      });

      return {
        ok: true as const,
        likeCount,
        liked: !existing,
      };
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      likeCount: result.likeCount,
      liked: result.liked,
    });
  } catch (e) {
    console.error("❌ like api error", {
      message: getSafeErrorMessage(e),
    });
    return NextResponse.json(
      { error: "いいね処理失敗" },
      { status: 500 }
    );
  }
}
