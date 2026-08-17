"use server";

import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { verifyBestViewCheckoutSession } from "@/lib/best-view-payment";
import { verifyQuestionCheckoutSession } from "@/lib/question-payment";
import { verifyNegotiationCheckoutSession } from "@/lib/negotiation-payment";
import { getBestViewRevenueBreakdown } from "@/lib/best-view-breakdown";
import { getQuestionRewardBreakdown } from "@/lib/reward-breakdown";
import { publicUserSelect } from "@/lib/public-user-select";

import QuestionImages from "./QuestionImages";
import QuestionReadClient from "./QuestionReadClient";
import QuestionInteractionClient from "./QuestionInteractionClient";
import QuestionPostedConversionTracker from "./QuestionPostedConversionTracker";
import PurchaseConversionTracker from "./PurchaseConversionTracker";
import QuestionRepurchaseButton from "./QuestionRepurchaseButton";
import ViewerPriceEditor from "./ViewerPriceEditor";
import AnswerDeadlineEditor from "./AnswerDeadlineEditor";
import CancellationRequestCard from "./CancellationRequestCard";
import QuestionSupplementSection from "./QuestionSupplementSection";
import QuestionBoostCard from "./QuestionBoostCard";
import type { QuestionAnswer } from "./types";
import {
  formatJapaneseDateTime,
  getQuestionCancelAvailableAt,
  getQuestionDeadlineState,
} from "@/lib/question-deadline";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { verifyBoostCheckoutSession } from "@/lib/boost-payment";
import { signAnswerImageReferences } from "@/lib/answer-image-storage";
import ReportButton from "@/app/components/ReportButton";

const questionDetailSelect = Prisma.validator<Prisma.QuestionSelect>()({
  id: true,
  createdAt: true,
  title: true,
  content: true,
  userId: true,
  categoryId: true,
  bestAnswerId: true,
  isClosed: true,
  rewardAmount: true,
  viewerPrice: true,
  boostCount: true,
  boostedAt: true,
  boostExpiresAt: true,
  answerDeadline: true,
  rewardPeriodStartedAt: true,
  rewardExpiresAt: true,
  rewardStoppedAt: true,
  isPaid: true,
  category: true,
  user: {
    select: publicUserSelect,
  },
  images: true,
  supplements: {
    orderBy: { createdAt: "asc" },
    select: { id: true, content: true, createdAt: true },
  },
  answers: {
    where: { reports: { none: { status: "CONFIRMED" } } },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: publicUserSelect,
      },
      images: true,
      negotiation: true,
      reads: true,
      comments: {
        where: { reports: { none: { status: "CONFIRMED" } } },
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: publicUserSelect,
          },
        },
      },
    },
  },
});

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
  const boostPaid = getSearchParam(sp?.boost_paid) === "1";
  const boostCancelled = getSearchParam(sp?.boost_cancel) === "1";
  const checkoutSessionId = getSearchParam(sp?.session_id);

  const authUser = await getCurrentUser();
  const isLoggedIn = !!authUser;

  const dbUser = authUser
    ? await prisma.user.findUnique({ where: { id: authUser.id } })
    : null;

  const ppConsentAt = dbUser?.ppConsentAt ?? null;
  const answerPagePath = `/questions/${id}`;

  const initialQuestion = await prisma.question.findFirst({
    where: {
      id,
      cancellationRequests: { none: { status: "approved" } },
      reports: { none: { status: "CONFIRMED" } },
    },
    select: questionDetailSelect,
  });

  if (!initialQuestion) {
    notFound();
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
  const boostPaymentVerification =
    boostPaid && checkoutSessionId
      ? await verifyBoostCheckoutSession({
          sessionId: checkoutSessionId,
          expectedQuestionId: id,
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
        bestViewPaymentVerification.createdPurchase) ||
      (boostPaymentVerification?.ok &&
        boostPaymentVerification.isPaid &&
        boostPaymentVerification.updated)
  );

  const question = shouldRefetchQuestion
    ? await prisma.question.findFirst({
        where: {
          id,
          cancellationRequests: { none: { status: "approved" } },
          reports: { none: { status: "CONFIRMED" } },
        },
        select: questionDetailSelect,
      })
    : initialQuestion;

  if (!question) {
    notFound();
  }

  const latestCancellationRequest = await prisma.cancellationRequest.findFirst({
    where: {
      questionId: question.id,
    },
    orderBy: { requestedAt: "desc" },
    select: {
      status: true,
      requestedAt: true,
      adminNote: true,
    },
  });

  const cancellationAvailableAt = getQuestionCancelAvailableAt({
    createdAt: question.createdAt,
    answerDeadline: question.answerDeadline,
  });
  const isCancellationOldEnough = cancellationAvailableAt <= new Date();
  const questionDeadlineState = getQuestionDeadlineState({
    answerDeadline: question.answerDeadline,
  });
  const questionDeadlineLabel = formatJapaneseDateTime(question.answerDeadline);
  const canRequestCancellation =
    isAuthor &&
    isCancellationOldEnough &&
    !question.bestAnswerId &&
    latestCancellationRequest?.status !== "pending" &&
    latestCancellationRequest?.status !== "approved";

  const rewardBreakdown = getQuestionRewardBreakdown(question.rewardAmount);
  const bestViewBreakdown = getBestViewRevenueBreakdown(question.viewerPrice ?? 0);
  const acceptedNegotiationAnswer = question.answers.find(
    (answer) => answer.negotiation?.status === "ACCEPTED"
  );
  const negotiationPurchaseAmount =
    acceptedNegotiationAnswer?.negotiation?.proposedAmount !== undefined
      ? Math.max(
          0,
          acceptedNegotiationAnswer.negotiation.proposedAmount -
            question.rewardAmount
        )
      : null;

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
            kind: "best_view",
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
    notFound();
  }

  const isRewardStopped =
    question.isPaid &&
    question.isClosed &&
    !question.bestAnswerId &&
    !!question.rewardStoppedAt;

  // 関連質問
  const relatedQuestions = await prisma.question.findMany({
    where: {
      categoryId: question.categoryId,
      NOT: { id },
      isPaid: true,
      cancellationRequests: { none: { status: "approved" } },
      reports: { none: { status: "CONFIRMED" } },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: { category: true },
  });

  const answersWithLock: QuestionAnswer[] = question.answers.map((answer) => {
    const isBestAnswer = answer.id === question.bestAnswerId;
    const isAnswerOwner = !!authUser && answer.userId === authUser.id;
    const isAnswerParticipant = isAuthor || isAnswerOwner;
    const canViewThisAnswer =
      isAnswerParticipant || (isBestAnswer && hasPurchasedBestAnswer);
    const isLocked = !canViewThisAnswer;

    if (isLocked) {
      return {
        ...answer,
        userId: null,
        user: null,
        content: null,
        pitch: null,
        images: [],
        reads: [],
        comments: null,
        negotiation: null,
        locked: true,
      };
    }

    return {
      ...answer,
      reads: answer.reads.filter((read) => read.userId === (authUser?.id ?? "")),
      comments: isAnswerParticipant ? answer.comments : null,
      negotiation: isAnswerParticipant ? answer.negotiation : null,
      pitch: isAnswerParticipant ? answer.pitch : null,
      locked: false,
    };
  });

  const answersWithSignedImages = await Promise.all(
    answersWithLock.map(async (answer) => ({
      ...answer,
      images: await signAnswerImageReferences(answer.images),
    }))
  );
  const sortedAnswers = [...answersWithSignedImages].sort((a, b) => {
    if (a.id === question.bestAnswerId) return -1;
    if (b.id === question.bestAnswerId) return 1;
    return 0;
  });

  return (
    <div className="max-w-3xl mx-auto p-6 text-black">
      <QuestionPostedConversionTracker
        shouldTrack={showQuestionPaymentSuccess}
        sessionId={checkoutSessionId}
      />
      <PurchaseConversionTracker
        shouldTrack={showQuestionPaymentSuccess}
        purchaseType="question_post"
        sessionId={checkoutSessionId}
        fallbackAmount={rewardBreakdown.checkoutAmount}
      />
      <PurchaseConversionTracker
        shouldTrack={showBestViewPaymentSuccess}
        purchaseType="best_view"
        sessionId={checkoutSessionId}
        fallbackAmount={question.viewerPrice ?? null}
      />
      <PurchaseConversionTracker
        shouldTrack={showNegotiationPaymentSuccess}
        purchaseType="negotiation_accept"
        sessionId={checkoutSessionId}
        fallbackAmount={negotiationPurchaseAmount}
      />

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
      {boostPaymentVerification?.ok && boostPaymentVerification.isPaid && (
        <div className="mb-4 rounded bg-green-100 p-3 text-sm text-green-800">
          Boostを適用しました。3日間、質問一覧の上部へ表示されます。
        </div>
      )}
      {boostCancelled && (
        <div className="mb-4 rounded bg-yellow-100 p-3 text-sm text-yellow-800">
          Boost決済はキャンセルされました。
        </div>
      )}
      {(!question.isPaid || isRewardStopped) && isAuthor && (
        <div className="mb-4 p-4 rounded border border-blue-200 bg-blue-50">
          <p className="text-sm text-blue-900 mb-3">
            {isRewardStopped
              ? "90日間の報酬期間が終了しています。新しい質問報酬と10%の利用料を決済すると、回答受付を90日間再開できます。"
              : "この質問はまだ公開されていません。決済を完了すると公開されます。"}
          </p>
          <QuestionRepurchaseButton
            questionId={question.id}
            checkoutAmount={rewardBreakdown.checkoutAmount}
          />
        </div>
      )}

      {isAuthor && (
        <CancellationRequestCard
          questionId={question.id}
          canRequest={canRequestCancellation}
          isOldEnough={isCancellationOldEnough}
          cancelAvailableAt={cancellationAvailableAt.toISOString()}
          answerDeadline={question.answerDeadline?.toISOString() ?? null}
          existingStatus={latestCancellationRequest?.status ?? null}
          requestedAt={
            latestCancellationRequest?.requestedAt?.toISOString() ?? null
          }
          adminNote={latestCancellationRequest?.adminNote ?? null}
        />
      )}

      {isAuthor &&
        question.isPaid &&
        !question.isClosed &&
        question.rewardAmount >= 3000 &&
        question.boostCount < 3 && (
          <QuestionBoostCard
            questionId={question.id}
            rewardAmount={question.rewardAmount}
            boostCount={question.boostCount}
          />
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
      {isLoggedIn && !isAuthor && (
        <ReportButton targetType="question" targetId={question.id} />
      )}

      {/* カテゴリー */}
      <p className="text-sm text-gray-500 mb-4">
        カテゴリー：{question.category?.name}
      </p>
      {question.boostExpiresAt && question.boostExpiresAt > new Date() && (
        <div className="mb-4 inline-flex rounded-full bg-orange-600 px-3 py-1 text-xs font-bold text-white">
          🔥 Boost中（{formatJapaneseDateTime(question.boostExpiresAt)}まで）
        </div>
      )}

      <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
        <div className="font-semibold text-gray-900">回答期限</div>
        <p className="mt-1">
          {question.answerDeadline
            ? questionDeadlineState === "expired"
              ? `回答期限終了：${questionDeadlineLabel}`
              : `回答期限：${questionDeadlineLabel}`
            : "回答期限なし"}
        </p>
        <p className="mt-2 text-xs leading-6 text-gray-500">
          {question.answerDeadline
            ? "この期限を過ぎると、質問者はキャンセル申請できるようになります。"
            : "回答期限を設定していない場合は、投稿から2週間後にキャンセル申請できます。"}
        </p>
        <p className="mt-1 text-xs leading-6 text-gray-500">
          キャンセル申請可能日：
          {formatJapaneseDateTime(cancellationAvailableAt)}
        </p>
      </div>

      {isAuthor && !question.isClosed && (
        <AnswerDeadlineEditor
          questionId={question.id}
          initialAnswerDeadline={
            question.answerDeadline?.toISOString() ?? null
          }
        />
      )}

      {/* 本文 */}
      <div className="whitespace-pre-line">{question.content}</div>

      <QuestionSupplementSection
        questionId={question.id}
        initialSupplements={question.supplements.map((supplement) => ({
          ...supplement,
          createdAt: supplement.createdAt.toISOString(),
        }))}
        isAuthor={isAuthor}
      />

      {/* 画像 */}
      {question.images.length > 0 && (
        <QuestionImages images={question.images} />
      )}

      {/* 報酬 */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="font-bold text-gray-900">
          表示報酬：{rewardBreakdown.grossAmount.toLocaleString("ja-JP")}円
        </div>
        <div className="mt-3 grid gap-3 text-sm text-gray-700 sm:grid-cols-3">
          <div className="rounded-lg bg-white px-3 py-2">
            <div className="text-xs text-gray-500">受取予定額</div>
            <div className="font-semibold text-gray-900">
              {rewardBreakdown.answererNetAmount.toLocaleString("ja-JP")}円
            </div>
          </div>
          <div className="rounded-lg bg-white px-3 py-2">
            <div className="text-xs text-gray-500">手数料</div>
            <div className="font-semibold text-gray-900">
              {rewardBreakdown.platformFeeAmount.toLocaleString("ja-JP")}円
            </div>
          </div>
          <div className="rounded-lg bg-white px-3 py-2">
            <div className="text-xs text-gray-500">質問者の決済額</div>
            <div className="font-semibold text-gray-900">
              {rewardBreakdown.checkoutAmount.toLocaleString("ja-JP")}円
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs leading-6 text-gray-600">
          この質問では、表示報酬額のうち10%がプラットフォーム手数料となり、残りがBEST回答者へ付与されます。
        </p>
        {question.rewardExpiresAt && (
          <p className="mt-1 text-xs leading-6 text-gray-600">
            報酬期間終了: {formatJapaneseDateTime(question.rewardExpiresAt)}
          </p>
        )}
      </div>
      <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
        <div className="font-semibold text-yellow-900">
          実体験や知見を集めるための質問です
        </div>
        <p className="mt-2 text-sm leading-relaxed text-yellow-900/80">
          一般論ではなく、実際に経験した人の判断や工夫を集めることを前提にしています。
          背景や悩みが具体的なほど、より深い回答が届きやすくなります。
        </p>
      </div>
      <div className="mt-2 p-4 bg-gray-100 rounded">
        BEST閲覧価格：
        {question.viewerPrice && question.viewerPrice > 0
          ? `${question.viewerPrice.toLocaleString("ja-JP")}円`
          : "未設定"}
      </div>
      {question.viewerPrice && question.viewerPrice > 0 && (
        <div className="mt-2 rounded-xl border border-yellow-100 bg-yellow-50 p-4 text-sm text-gray-700">
          <div className="font-semibold text-gray-900">BEST閲覧料の分配</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-white px-3 py-2">
              <div className="text-xs text-gray-500">質問者への報酬</div>
              <div className="font-semibold text-gray-900">
                {bestViewBreakdown.questionOwnerAmount.toLocaleString("ja-JP")}円
              </div>
            </div>
            <div className="rounded-lg bg-white px-3 py-2">
              <div className="text-xs text-gray-500">BEST回答者への報酬</div>
              <div className="font-semibold text-gray-900">
                {bestViewBreakdown.answerOwnerAmount.toLocaleString("ja-JP")}円
              </div>
            </div>
            <div className="rounded-lg bg-white px-3 py-2">
              <div className="text-xs text-gray-500">プラットフォーム手数料</div>
              <div className="font-semibold text-gray-900">
                {bestViewBreakdown.platformFeeAmount.toLocaleString("ja-JP")}円
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs leading-6 text-gray-600">
            このBEST回答は有料公開でき、閲覧料金の50%を質問者、20%をBEST回答者へ還元します。
          </p>
        </div>
      )}
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
