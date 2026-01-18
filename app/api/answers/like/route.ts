import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { supabaseServer } from "@/lib/supabase-server";

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

    // すでに押してるか？
    const existing = await prisma.answerLike.findUnique({
      where: {
        userId_answerId: {
          userId: user.id,
          answerId,
        },
      },
    });

    if (!existing) {
      // 👍 まだ → 追加
      await prisma.answerLike.create({
        data: {
          userId: user.id,
          answerId,
        },
      });
    } else {
      // 👎 すでに押してる → 解除
      await prisma.answerLike.delete({
        where: {
          userId_answerId: {
            userId: user.id,
            answerId,
          },
        },
      });
    }

    // 最新いいね数を返す
    const likeCount = await prisma.answerLike.count({
      where: { answerId },
    });

    return NextResponse.json({ likeCount });
  } catch (e) {
    console.error("❌ like api error", e);
    return NextResponse.json(
      { error: "いいね処理失敗" },
      { status: 500 }
    );
  }
}
