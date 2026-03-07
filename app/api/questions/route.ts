// app/api/questions/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { supabaseServer } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";

// ================================
// ファイル名を安全に変換（日本語・スペース禁止）
// ================================
function safeFileName(originalName: string) {
  return (
    "q_" +
    Date.now() +
    "_" +
    originalName
      .replace(/[^\w.]+/g, "_") // 日本語やスペースを _ に
      .replace(/_+/g, "_") // _ を整理
  );
}

// ================================
// 質問一覧（GET）
// ================================
export async function GET() {
  try {
    const authUser = await getCurrentUser();

    const rawQuestions = await prisma.question.findMany({
      orderBy: { createdAt: "desc" },
      include: { category: true, answers: true, images: true },
    });

    const questions = rawQuestions.map((question) => {
      const isAuthor = authUser?.id === question.userId;

      const answers = question.answers.map((answer) => {
        const isLockedBest = answer.id === question.bestAnswerId && !isAuthor;

        if (isLockedBest) {
          return {
            ...answer,
            content: null,
            images: [],
            comments: null,
            locked: true,
          };
        }

        return {
          ...answer,
          locked: false,
        };
      });

      return {
        ...question,
        answers,
      };
    });

    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ questions, categories });
  } catch (error) {
    console.error("❌ GET /api/questions Error:", error);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}

// ================================
// 質問投稿（POST）
// ================================
export async function POST(req: Request) {
  try {
    // 🔹 Supabase（Server）クライアントを生成
    const supabase = await supabaseServer();

    // --- 認証ユーザー確認 ---
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "ログインしてください" },
        { status: 401 }
      );
    }

    // --- Prisma.User に存在するか確認 ---
    let prismaUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    // 自動作成
    if (!prismaUser) {
      prismaUser = await prisma.user.create({
        data: {
          id: user.id,
          email: user.email!,
        },
      });
    }

    // --- multipart/form-data ---
    const formData = await req.formData();

    const title = formData.get("title")?.toString();
    const body = formData.get("body")?.toString();
    const categoryId = formData.get("categoryId")?.toString();
    const rewardAmount = Number(formData.get("rewardAmount") || 0);

    // 入力チェック
    if (!title || !body || !categoryId) {
      return NextResponse.json(
        { error: "必須項目が不足しています" },
        { status: 400 }
      );
    }

    // --- カテゴリ存在チェック（IDで検索） ---
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return NextResponse.json(
        { error: "カテゴリーが存在しません" },
        { status: 400 }
      );
    }

    // ---------------------------
    // 1. 質問を保存
    // ---------------------------
    const newQuestion = await prisma.question.create({
      data: {
        title,
        content: body,
        userId: prismaUser.id,
        categoryId,
        rewardAmount,
      },
    });

    // ---------------------------
    // 2. 画像アップロード
    // ---------------------------
    const images = formData.getAll("images") as File[];
    let sortOrder = 0;

    for (const file of images) {
      if (!(file instanceof File) || file.size === 0) continue;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 日本語 + ドット除去・安全名に変換
      const safeName = safeFileName(file.name)
        .replace(/\./g, "_") // ドット除去
        .replace(/[^A-Za-z0-9_]/g, "_");

      const fileName = `questions/${newQuestion.id}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("question-images")
        .upload(fileName, buffer, {
          contentType: file.type,
        });

      if (uploadError) {
        console.error("画像アップロード失敗:", uploadError);
        continue;
      }

      const { data: publicUrlData } = supabase.storage
        .from("question-images")
        .getPublicUrl(fileName);

      await prisma.questionImage.create({
        data: {
          questionId: newQuestion.id,
          url: publicUrlData.publicUrl,
          sortOrder,
        },
      });

      sortOrder++;
    }

    return NextResponse.json({ id: newQuestion.id });
  } catch (error) {
    console.error("❌ POST /api/questions Error:", error);
    return NextResponse.json(
      { error: "投稿に失敗しました" },
      { status: 500 }
    );
  }
}
