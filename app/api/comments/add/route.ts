import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { content, answerId } = body;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authorized" }, { status: 401 });
    }

    const newComment = await prisma.comment.create({
      data: {
        content,
        answerId,
        userId: user.id,
      },
      include: {
        user: true, // コメントしたユーザー情報も返す
      },
    });

    return NextResponse.json(newComment);
  } catch (error) {
    console.error("コメント追加エラー:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
