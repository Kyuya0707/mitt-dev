"use server";

import Link from "next/link";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

import QuestionImages from "./QuestionImages";
import QuestionReadClient from "./QuestionReadClient";
import QuestionInteractionClient from "./QuestionInteractionClient";
import type { QuestionAnswer } from "./types";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/* =========================================================
   ★ Server Action：回答を既読として保存（AnswerRead）
========================================================= */
export async function markRead(answerId: string) {
  "use server";

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name, options) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  await prisma.answerRead.upsert({
    where: {
      userId_answerId: {
        userId: user.id,
        answerId,
      },
    },
    update: {},
    create: {
      userId: user.id,
      answerId,
    },
  });

  return true;
}

/* =========================================================
   ページ本体（Server Component）
========================================================= */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;

  const sp = searchParams ? await searchParams : undefined;
  const fromNotification = sp?.from === "notification";

  // 🔹 Stripe redirect params
  const justPaid = sp?.paid === "1";
  const isCancelled = sp?.cancel === "1";

  const authUser = await getCurrentUser();
  const isLoggedIn = !!authUser;

  const dbUser = authUser
    ? await prisma.user.findUnique({ where: { id: authUser.id } })
    : null;

  const consentAt = dbUser?.consentAt ?? null;

  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      category: true,
      user: true,
      answers: {
        include: {
          user: true,
          images: true,
          negotiation: true,
          reads: { where: { userId: authUser?.id ?? "" } },
          comments: {
            include: { user: true },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      images: true,
    },
  });

  if (!question) {
    return <div className="p-6">質問が見つかりません。</div>;
  }

  const isAuthor = authUser?.id === question.userId;
  const hasPurchasedBestAnswer = false;
  const canViewBestAnswer = isAuthor || hasPurchasedBestAnswer;

  /* =========================================================
     🔒 未決済のとき → 投稿者以外には非公開
  ========================================================== */
  if (!question.isPaid && !isAuthor) {
    return (
      <div className="max-w-3xl mx-auto p-6 mt-10 text-black">
        <h1 className="text-xl font-bold mb-3">
          この質問はまだ公開されていません
        </h1>
        <p className="text-gray-700 mb-6">
          質問者が決済を完了するまで、内容は非公開です。
        </p>

        <Link href="/" className="text-blue-600 underline">
          ← 質問一覧に戻る
        </Link>
      </div>
    );
  }

  // 関連質問
  const relatedQuestions = await prisma.question.findMany({
    where: {
      categoryId: question.categoryId,
      NOT: { id },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: { category: true },
  });

  const answersWithLock: QuestionAnswer[] = question.answers.map((answer) => {
    const isLockedBest =
      answer.id === question.bestAnswerId && !canViewBestAnswer;

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

  const sortedAnswers = [...answersWithLock].sort((a, b) => {
    if (a.id === question.bestAnswerId) return -1;
    if (b.id === question.bestAnswerId) return 1;
    return 0;
  });

  return (
    <div className="max-w-3xl mx-auto p-6 text-black">
      {/* 🔔 通知経由 */}
      <QuestionReadClient questionId={id} fromNotification={fromNotification} />

      {/* 🔔 Stripe 完了メッセージ */}
      {justPaid && (
        <div className="mb-4 p-3 rounded bg-green-100 text-green-800 text-sm">
          決済が完了しました。質問が公開されました 🙌
        </div>
      )}

      {isCancelled && (
        <div className="mb-4 p-3 rounded bg-yellow-100 text-yellow-800 text-sm">
          決済がキャンセルされました。この質問はまだ公開されていません。
        </div>
      )}

      {/* 戻る */}
      <Link
        href="/"
        className="text-sm text-blue-600 hover:underline mb-4 inline-block"
      >
        ← 質問一覧へ戻る
      </Link>

      {/* タイトル */}
      <h1 className="text-2xl font-bold mb-2 bg-white p-3 rounded shadow">
        {question.title}
      </h1>

      {/* カテゴリー */}
      <p className="text-sm text-gray-500 mb-4">
        カテゴリー：{question.category?.name}
      </p>

      {/* 本文 */}
      <div className="whitespace-pre-line">{question.content}</div>

      {/* 画像 */}
      {question.images.length > 0 && (
        <QuestionImages images={question.images} />
      )}

      {/* 報酬 */}
      <div className="mt-6 p-4 bg-gray-100 rounded font-bold">
        報酬額：{question.rewardAmount}円
      </div>

      {/* 回答UI */}
      <QuestionInteractionClient
        questionId={id}
        consentAt={consentAt ? consentAt.toISOString() : null}
        questionTitle={question.title}
        questionContent={question.content}
        answers={sortedAnswers}
        bestAnswerId={question.bestAnswerId}
        isAuthor={isAuthor}
        isLoggedIn={isLoggedIn}
        isClosed={question.isClosed}
        fromNotification={fromNotification}
        markRead={markRead}
        currentUserId={authUser?.id ?? null}
      />

      {/* 関連質問 */}
      {relatedQuestions.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-bold mb-3">
            同じカテゴリーの他の質問
          </h2>
          <ul className="space-y-2">
            {relatedQuestions.map((q) => (
              <li key={q.id}>
                <Link
                  className="text-sm text-blue-600 hover:underline"
                  href={`/questions/${q.id}`}
                >
                  {q.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isLoggedIn && (
        <div className="mt-10 p-6 bg-gray-50 text-center border rounded">
          回答するにはログインが必要です。
        </div>
      )}
    </div>
  );
}
