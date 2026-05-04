"use server";

import Link from "next/link";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { verifyBestViewCheckoutSession } from "@/lib/best-view-payment";
import { verifyQuestionCheckoutSession } from "@/lib/question-payment";
import { verifyNegotiationCheckoutSession } from "@/lib/negotiation-payment";

import QuestionImages from "./QuestionImages";
import QuestionReadClient from "./QuestionReadClient";
import QuestionInteractionClient from "./QuestionInteractionClient";
import QuestionRepurchaseButton from "./QuestionRepurchaseButton";
import ViewerPriceEditor from "./ViewerPriceEditor";
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
  const fromNotification = getSearchParam(sp?.from) === "notification";

  // 🔹 Stripe redirect params
  const justPaid = getSearchParam(sp?.paid) === "1";
  const isCancelled = getSearchParam(sp?.cancel) === "1";
  const negotiationPaid = getSearchParam(sp?.negotiation_paid) === "1";
  const negotiationCancelled = getSearchParam(sp?.negotiation_cancel) === "1";
  const bestViewPaid = getSearchParam(sp?.best_view_paid) === "1";
  const bestViewCancelled = getSearchParam(sp?.best_view_cancel) === "1";
  const checkoutSessionId = getSearchParam(sp?.session_id);

  const authUser = await getCurrentUser();
  const isLoggedIn = !!authUser;

  const dbUser = authUser
    ? await prisma.user.findUnique({ where: { id: authUser.id } })
    : null;

  const ppConsentAt = dbUser?.ppConsentAt ?? null;
  const answerPagePath = `/questions/${id}`;

  const initialQuestion = await prisma.question.findUnique({
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

  if (!initialQuestion) {
    return <div className="p-6">質問が見つかりません。</div>;
  }

  const isAuthor = authUser?.id === initialQuestion.userId;

  const questionPaymentVerification =
    justPaid && checkoutSessionId
      ? await verifyQuestionCheckoutSession({
          questionId: id,
          sessionId: checkoutSessionId,
        })
      : null;
  const negotiationPaymentVerification =
    negotiationPaid && checkoutSessionId
      ? await verifyNegotiationCheckoutSession({
          questionId: id,
          sessionId: checkoutSessionId,
        })
      : null;
  const bestViewPaymentVerification =
    bestViewPaid && checkoutSessionId
      ? await verifyBestViewCheckoutSession({
          questionId: id,
          sessionId: checkoutSessionId,
        })
      : null;

  const shouldRefetchQuestion = Boolean(
    (questionPaymentVerification?.ok &&
      questionPaymentVerification.isPaid &&
      questionPaymentVerification.updatedQuestion) ||
      (negotiationPaymentVerification?.ok &&
        negotiationPaymentVerification.isPaid &&
        negotiationPaymentVerification.updatedNegotiation) ||
      (bestViewPaymentVerification?.ok &&
        bestViewPaymentVerification.isPaid &&
        bestViewPaymentVerification.createdPurchase)
  );

  const question = shouldRefetchQuestion
    ? await prisma.question.findUnique({
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
      })
    : initialQuestion;

  if (!question) {
    return <div className="p-6">質問が見つかりません。</div>;
  }

  const showQuestionPaymentSuccess =
    !!questionPaymentVerification?.ok && questionPaymentVerification.isPaid;
  const showQuestionPaymentPending =
    justPaid && !showQuestionPaymentSuccess;
  const showNegotiationPaymentSuccess =
    !!negotiationPaymentVerification?.ok &&
    negotiationPaymentVerification.isPaid;
  const showNegotiationPaymentPending =
    negotiationPaid && !showNegotiationPaymentSuccess;
  const showBestViewPaymentSuccess =
    !!bestViewPaymentVerification?.ok && bestViewPaymentVerification.isPaid;
  const showBestViewPaymentPending =
    bestViewPaid && !showBestViewPaymentSuccess;

  const bestAnswerOwnerId =
    question.bestAnswerId
      ? question.answers.find((answer) => answer.id === question.bestAnswerId)?.userId ??
        null
      : null;
  const isBestAnswerOwner =
    !!authUser && !!bestAnswerOwnerId && authUser.id === bestAnswerOwnerId;
  const hasPurchasedBestAnswer =
    !!authUser
      ? (await prisma.purchase.findFirst({
          where: {
            userId: authUser.id,
            questionId: question.id,
            status: "PAID",
          },
          select: { id: true },
        })) !== null
      : false;
  const canViewBestAnswer =
    isAuthor || isBestAnswerOwner || hasPurchasedBestAnswer;

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

        <Link href="/questions" className="text-blue-600 underline">
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
    const isBestAnswer = answer.id === question.bestAnswerId;
    const isAnswerOwner = !!authUser && answer.userId === authUser.id;
    const canViewThisAnswer =
      !isBestAnswer ||
      isAuthor ||
      isAnswerOwner ||
      hasPurchasedBestAnswer;
    const isLockedBest = isBestAnswer && !canViewThisAnswer;

    if (isLockedBest) {
      return {
        ...answer,
        content: null,
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
      <QuestionReadClient
        questionId={id}
        fromNotification={fromNotification}
        isQuestionOwner={isAuthor}
      />

      {/* 🔔 Stripe 完了メッセージ */}
      {showQuestionPaymentSuccess && (
        <div className="mb-4 p-3 rounded bg-green-100 text-green-800 text-sm">
          決済を確認しました。質問を公開しました。
        </div>
      )}
      {showQuestionPaymentPending && (
        <div className="mb-4 p-3 rounded bg-blue-100 text-blue-800 text-sm">
          購入を確認中です。反映まで数秒かかる場合があります。必要に応じてページを再読み込みしてください。
        </div>
      )}

      {isCancelled && (
        <div className="mb-4 p-3 rounded bg-yellow-100 text-yellow-800 text-sm">
          決済はキャンセルされました。再度購入する場合はボタンからお進みください。
        </div>
      )}
      {showNegotiationPaymentSuccess && (
        <div className="mb-4 p-3 rounded bg-green-100 text-green-800 text-sm">
          交渉成立時の追加決済が完了しました。
        </div>
      )}
      {showNegotiationPaymentPending && (
        <div className="mb-4 p-3 rounded bg-blue-100 text-blue-800 text-sm">
          交渉成立時の追加決済を確認中です。反映まで数秒かかる場合があります。必要に応じてページを再読み込みしてください。
        </div>
      )}
      {negotiationCancelled && (
        <div className="mb-4 p-3 rounded bg-yellow-100 text-yellow-800 text-sm">
          決済はキャンセルされました。再度購入する場合はボタンからお進みください。
        </div>
      )}
      {showBestViewPaymentSuccess && (
        <div className="mb-4 p-3 rounded bg-green-100 text-green-800 text-sm">
          BEST回答の閲覧購入が完了しました。
        </div>
      )}
      {showBestViewPaymentPending && !canViewBestAnswer && (
        <div className="mb-4 p-3 rounded bg-blue-100 text-blue-800 text-sm">
          購入を確認中です。数秒後に閲覧可能になります。必要に応じてページを再読み込みしてください。
        </div>
      )}
      {bestViewCancelled && (
        <div className="mb-4 p-3 rounded bg-yellow-100 text-yellow-800 text-sm">
          決済はキャンセルされました。再度購入する場合はボタンからお進みください。
        </div>
      )}
      {!question.isPaid && isAuthor && (
        <div className="mb-4 p-4 rounded border border-blue-200 bg-blue-50">
          <p className="text-sm text-blue-900 mb-3">
            この質問はまだ公開されていません。決済を完了すると公開されます。
          </p>
          <QuestionRepurchaseButton questionId={question.id} />
        </div>
      )}

      {/* 戻る */}
      <Link
        href="/questions"
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
      <div className="mt-2 p-4 bg-gray-100 rounded">
        BEST閲覧価格：
        {question.viewerPrice && question.viewerPrice > 0
          ? `${question.viewerPrice.toLocaleString("ja-JP")}円`
          : "未設定"}
      </div>
      {isAuthor && (
        <ViewerPriceEditor
          questionId={question.id}
          initialViewerPrice={question.viewerPrice}
        />
      )}

      {/* 回答UI */}
      <QuestionInteractionClient
        questionId={id}
        ppConsentAt={ppConsentAt ? ppConsentAt.toISOString() : null}
        questionTitle={question.title}
        questionContent={question.content}
        answerPagePath={answerPagePath}
        questionRewardAmount={question.rewardAmount}
        viewerPrice={question.viewerPrice}
        answers={sortedAnswers}
        bestAnswerId={question.bestAnswerId}
        isQuestionOwner={isAuthor}
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
          <p className="mb-3">回答するにはログインが必要です。</p>
          <Link
            href={`/login?redirectTo=${encodeURIComponent(answerPagePath)}`}
            className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            ログインしてこの質問に戻る
          </Link>
        </div>
      )}
    </div>
  );
}

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
