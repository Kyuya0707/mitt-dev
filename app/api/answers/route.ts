// app/api/answers/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { supabaseServer } from "@/lib/supabase-server";

// ================================
// ファイル名を安全に変換
// ================================
function safeFileName(originalName: string) {
  return (
    Date.now() +
    "_" +
    originalName.replace(/[^\w.]+/g, "_").replace(/_+/g, "_")
  );
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
    }

    const formData = await req.formData();

    const content = formData.get("content")?.toString() ?? "";
    const pitch = formData.get("pitch")?.toString() ?? "";
    const proposedAmountRaw = formData.get("proposedAmount")?.toString();
    const questionId = formData.get("questionId")?.toString();
    const images = formData.getAll("images") as File[];

    const proposedAmount = Number(proposedAmountRaw);

    if (!questionId) {
      return NextResponse.json(
        { error: "質問IDが不足しています" },
        { status: 400 }
      );
    }

    if (!pitch.trim()) {
      return NextResponse.json(
        { error: "交渉メッセージ（pitch）が不足しています" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(proposedAmount) || proposedAmount < 100) {
      return NextResponse.json(
        { error: "提案金額は100円以上で入力してください" },
        { status: 400 }
      );
    }

    // ① Answer 登録（pitchも保存）
    const answer = await prisma.answer.create({
      data: {
        content,          // 本文は任意（後で必須/非表示にもできる）
        pitch,            // 交渉文
        questionId,
        userId: user.id,
      },
    });

    // ② Negotiation 作成（1 answer : 1 negotiation）
    await prisma.negotiation.create({
      data: {
        answerId: answer.id,
        proposedAmount,
        status: "PENDING",
      },
    });

    // ③ 画像アップロード
    let sortOrder = 0;

    for (const file of images) {
      if (!(file instanceof File) || file.size === 0) continue;

      const safeName = safeFileName(file.name);
      const filePath = `answers/${answer.id}_${safeName}`;

      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from("answer-images")
        .upload(filePath, buffer, { contentType: file.type });

      if (uploadError) {
        console.error("画像アップロード失敗:", uploadError);
        continue;
      }

      const { data: publicUrlData } = supabase.storage
        .from("answer-images")
        .getPublicUrl(filePath);

      await prisma.answerImage.create({
        data: {
          answerId: answer.id,
          url: publicUrlData.publicUrl,
          sortOrder,
        },
      });

      sortOrder++;
    }

    return NextResponse.json({ id: answer.id });
  } catch (error) {
    console.error("❌ POST /api/answers Error:", error);
    return NextResponse.json({ error: "回答の投稿に失敗しました" }, { status: 500 });
  }
}
