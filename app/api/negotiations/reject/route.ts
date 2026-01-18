// app/api/negotiations/reject/route.ts
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
      return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const negotiationId = body.negotiationId as string | undefined;

    if (!negotiationId) {
      return NextResponse.json({ error: "negotiationId is required" }, { status: 400 });
    }

    // ✅ 質問者本人だけが見送りできるようにする（Answer → Question.userId を辿る）
    const negotiation = await prisma.negotiation.findUnique({
      where: { id: negotiationId },
      select: {
        id: true,
        status: true,
        answer: {
          select: {
            question: { select: { userId: true } },
          },
        },
      },
    });

    if (!negotiation) {
      return NextResponse.json({ error: "Negotiation not found" }, { status: 404 });
    }

    const questionAuthorId = negotiation.answer?.question?.userId;
    if (!questionAuthorId || questionAuthorId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (negotiation.status !== "PENDING") {
      return NextResponse.json({ error: "Not pending" }, { status: 400 });
    }

    await prisma.negotiation.update({
      where: { id: negotiationId },
      data: { status: "REJECTED" },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("❌ POST /api/negotiations/reject error:", e);
    return NextResponse.json({ error: e.message ?? "server error" }, { status: 500 });
  }
}
