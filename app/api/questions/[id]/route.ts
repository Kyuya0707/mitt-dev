// app/api/questions/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // ★ Next.js 16 スタイル：Promise を await してから id を取り出す
  const { id } = await params;

  try {
    const question = await prisma.question.findUnique({
      where: { id }, // ← ここを修正（params.id ではなく id）
      include: {
        category: true,
        user: true,
        images: true, // 質問に紐づく画像
        answers: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: "質問が見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(question);
  } catch (error) {
    console.error("❌ GET /questions/[id] Error:", error);
    return NextResponse.json(
      { error: "サーバーエラー" },
      { status: 500 }
    );
  }
}
