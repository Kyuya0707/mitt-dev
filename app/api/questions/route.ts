// app/api/questions/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { supabaseServer } from "@/lib/supabase-server";
import { validateViewerPrice } from "@/lib/viewer-price";
import { durationMs, logPerf, nowMs } from "@/lib/perf";

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

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const PUBLIC_QUESTION_LIST_CACHE_CONTROL =
  "public, s-maxage=30, stale-while-revalidate=300";

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.trunc(parsed);
}

function buildQuestionListWhere(params: {
  q: string;
  categoryId: string;
  categoryName: string;
  excludeBest: boolean;
}) {
  const where: Prisma.QuestionWhereInput = {
    cancellationRequests: {
      none: {
        status: "approved",
      },
    },
  };

  if (params.q) {
    where.OR = [
      {
        title: {
          contains: params.q,
          mode: "insensitive",
        },
      },
      {
        content: {
          contains: params.q,
          mode: "insensitive",
        },
      },
    ];
  }

  if (params.categoryId) {
    where.categoryId = params.categoryId;
  } else if (params.categoryName) {
    where.category = {
      name: params.categoryName,
    };
  }

  if (params.excludeBest) {
    where.bestAnswerId = null;
  }

  return where;
}

function buildQuestionListOrderBy(sort: string): Prisma.QuestionOrderByWithRelationInput {
  switch (sort) {
    case "reward":
      return { rewardAmount: "desc" };
    case "answers":
      return { answers: { _count: "desc" } };
    case "latest":
    case "new":
    default:
      return { createdAt: "desc" };
  }
}

function buildQuestionExcerpt(content: string, maxLength = 120) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}…`;
}

// ================================
// 質問一覧（GET）
// ================================
export async function GET(req: Request) {
  const totalStart = nowMs();
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const categoryId = url.searchParams.get("categoryId")?.trim() ?? "";
    const categoryName = url.searchParams.get("category")?.trim() ?? "";
    const sort = url.searchParams.get("sort")?.trim() ?? "latest";
    const excludeBest =
      url.searchParams.get("excludeBest") === "1" ||
      url.searchParams.get("excludeBest") === "true";
    const page = parsePositiveInt(url.searchParams.get("page"), DEFAULT_PAGE);
    const limit = Math.min(
      parsePositiveInt(url.searchParams.get("limit"), DEFAULT_LIMIT),
      MAX_LIMIT
    );
    const skip = (page - 1) * limit;

    const where = buildQuestionListWhere({
      q,
      categoryId,
      categoryName,
      excludeBest,
    });
    const orderBy = buildQuestionListOrderBy(sort);

    const countStart = nowMs();
    const total = await prisma.question.count({ where });
    const countDuration = durationMs(countStart);
    const findManyStart = nowMs();
    const rawQuestions = await prisma.question.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        content: true,
        rewardAmount: true,
        viewerPrice: true,
        createdAt: true,
        isClosed: true,
        isPaid: true,
        bestAnswerId: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            answers: true,
          },
        },
      },
    });
    const findManyDuration = durationMs(findManyStart);

    const items = rawQuestions.map((question) => ({
      id: question.id,
      title: question.title,
      content: buildQuestionExcerpt(question.content),
      rewardAmount: question.rewardAmount,
      viewerPrice: question.viewerPrice,
      createdAt: question.createdAt,
      isClosed: question.isClosed,
      isPaid: question.isPaid,
      bestAnswerId: question.bestAnswerId,
      category: question.category,
      answerCount: question._count.answers,
    }));

    const totalPages = total === 0 ? 1 : Math.ceil(total / limit);

    logPerf("questions.GET", {
      total: `${durationMs(totalStart)}ms`,
      count: `${countDuration}ms`,
      findMany: `${findManyDuration}ms`,
      items: items.length,
      page,
      limit,
      sort,
    });

    return NextResponse.json(
      {
        items,
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
      },
      {
        headers: {
          "Cache-Control": PUBLIC_QUESTION_LIST_CACHE_CONTROL,
        },
      }
    );
  } catch (error) {
    console.error("❌ GET /api/questions Error:", error);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}

// ================================
// 質問投稿（POST）
// ================================
export async function POST(req: Request) {
  const totalStart = nowMs();
  try {
    // 🔹 Supabase（Server）クライアントを生成
    const supabase = await supabaseServer();

    // --- 認証ユーザー確認 ---
    const authStart = nowMs();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const authDuration = durationMs(authStart);

    if (!user) {
      return NextResponse.json(
        { error: "ログインしてください" },
        { status: 401 }
      );
    }

    // --- Prisma.User に存在するか確認 ---
    const userCheckStart = nowMs();
    let prismaUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        ppConsentAt: true,
        consentAt: true,
      },
    });

    // 自動作成
    if (!prismaUser) {
      prismaUser = await prisma.user.create({
        data: {
          id: user.id,
          email: user.email!,
        },
        select: {
          id: true,
          ppConsentAt: true,
          consentAt: true,
        },
      });
    }
    const userCheckDuration = durationMs(userCheckStart);

    if (!prismaUser.ppConsentAt && !prismaUser.consentAt) {
      return NextResponse.json(
        {
          error:
            "質問を投稿するには、副業・税務に関する同意が必要です。",
        },
        { status: 403 }
      );
    }

    // --- multipart/form-data ---
    const formData = await req.formData();

    const title = formData.get("title")?.toString();
    const body = formData.get("body")?.toString();
    const categoryId = formData.get("categoryId")?.toString();
    const rewardAmount = Number(formData.get("rewardAmount") || 0);
    const viewerPriceRaw = formData.get("viewerPrice");

    // 入力チェック
    if (!title || !body || !categoryId) {
      return NextResponse.json(
        { error: "必須項目が不足しています" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(rewardAmount) || !Number.isInteger(rewardAmount)) {
      return NextResponse.json(
        { error: "報酬額は整数で入力してください" },
        { status: 400 }
      );
    }

    if (rewardAmount < 500) {
      return NextResponse.json(
        { error: "報酬額は500円以上で入力してください" },
        { status: 400 }
      );
    }

    const viewerPriceValidation = validateViewerPrice(viewerPriceRaw);
    if (!viewerPriceValidation.ok) {
      return NextResponse.json(
        { error: viewerPriceValidation.message },
        { status: 400 }
      );
    }

    // --- カテゴリ存在チェック（IDで検索） ---
    const categoryCheckStart = nowMs();
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    const categoryCheckDuration = durationMs(categoryCheckStart);

    if (!category) {
      return NextResponse.json(
        { error: "カテゴリーが存在しません" },
        { status: 400 }
      );
    }

    // ---------------------------
    // 1. 質問を保存
    // ---------------------------
    const questionCreateStart = nowMs();
    const newQuestion = await prisma.question.create({
      data: {
        title,
        content: body,
        userId: prismaUser.id,
        categoryId,
        rewardAmount,
        viewerPrice: viewerPriceValidation.value,
      },
    });
    const questionCreateDuration = durationMs(questionCreateStart);

    // ---------------------------
    // 2. 画像アップロード
    // ---------------------------
    const images = formData.getAll("images") as File[];
    const uploadStart = nowMs();
    const uploadedImages = await Promise.all(
      images.map(async (file, index) => {
        if (!(file instanceof File) || file.size === 0) {
          return null;
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const safeName = safeFileName(file.name)
          .replace(/\./g, "_")
          .replace(/[^A-Za-z0-9_]/g, "_");

        const fileName = `questions/${newQuestion.id}_${index}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("question-images")
          .upload(fileName, buffer, {
            contentType: file.type,
          });

        if (uploadError) {
          console.error("画像アップロード失敗:", uploadError);
          return null;
        }

        const { data: publicUrlData } = supabase.storage
          .from("question-images")
          .getPublicUrl(fileName);

        return {
          questionId: newQuestion.id,
          url: publicUrlData.publicUrl,
          sortOrder: index,
        };
      })
    );
    const uploadDuration = durationMs(uploadStart);

    const successfulImages = uploadedImages.filter(
      (
        image
      ): image is {
        questionId: string;
        url: string;
        sortOrder: number;
      } => image !== null
    );

    if (successfulImages.length > 0) {
      const imageDbStart = nowMs();
      await prisma.questionImage.createMany({
        data: successfulImages,
      });
      logPerf("questions.POST", {
        total: `${durationMs(totalStart)}ms`,
        auth: `${authDuration}ms`,
        user: `${userCheckDuration}ms`,
        category: `${categoryCheckDuration}ms`,
        create: `${questionCreateDuration}ms`,
        upload: `${uploadDuration}ms`,
        imageDb: `${durationMs(imageDbStart)}ms`,
        images: successfulImages.length,
      });
    } else {
      logPerf("questions.POST", {
        total: `${durationMs(totalStart)}ms`,
        auth: `${authDuration}ms`,
        user: `${userCheckDuration}ms`,
        category: `${categoryCheckDuration}ms`,
        create: `${questionCreateDuration}ms`,
        upload: `${uploadDuration}ms`,
        imageDb: "0ms",
        images: 0,
      });
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
