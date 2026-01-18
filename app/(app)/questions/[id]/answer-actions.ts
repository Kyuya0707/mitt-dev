// app/questions/[id]/answer-actions.ts
"use server";

import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import { createClientBrowser } from "@/lib/supabase-browser";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

// 安全なファイル名生成
function safeFileName(originalName: string) {
  return (
    Date.now() +
    "_" +
    originalName.replace(/[^\w.]+/g, "_").replace(/_+/g, "_")
  );
}

export async function createAnswerAction(formData: FormData) {
  const cookieStore = await cookies();
  const supabase = createClientBrowser();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("ログインが必要です");
  }

  const content = formData.get("content") as string;
  const questionId = formData.get("questionId") as string;
  const images = formData.getAll("images") as File[];

  if (!content || !questionId) {
    throw new Error("回答内容が不足しています");
  }

  // 1. 回答作成
  const answer = await prisma.answer.create({
    data: {
      content,
      questionId,
      userId: user.id,
    },
  });

  // 2. 画像アップロード
  let sortOrder = 0;

  for (const file of images) {
    if (!(file instanceof File) || file.size === 0) continue;

    const safeName = safeFileName(file.name);
    const path = `answers/${answer.id}_${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("answers")
      .upload(path, buffer, {
        contentType: file.type,
      });

    if (uploadError) {
      console.error("画像アップロード失敗:", uploadError);
      continue;
    }

    const { data: publicUrlData } = supabase.storage
      .from("answers")
      .getPublicUrl(path);

    await prisma.answerImage.create({
      data: {
        answerId: answer.id,
        url: publicUrlData.publicUrl,
        sortOrder,
      },
    });

    sortOrder++;
  }

  // 回答内容のあるページのみ再描画
  revalidatePath(`/questions/${questionId}`);
}
