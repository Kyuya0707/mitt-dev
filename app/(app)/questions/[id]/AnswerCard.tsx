// app/questions/[id]/AnswerCard.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import ImageLightbox from "./ImageLightbox";
import { StarIcon } from "@heroicons/react/24/solid";
import ReactMarkdown from "react-markdown";
import type { AnswerComment, QuestionAnswer } from "./types";
import { getPublicUserDisplayName } from "@/lib/public-user-display";
import { toJapaneseErrorMessage } from "@/lib/errors";
import { getBestViewRevenueBreakdown } from "@/lib/best-view-breakdown";
import {
  trackGA4BeginCheckout,
  trackGA4BestSelected,
} from "@/lib/ga";
import ReportButton from "@/app/components/ReportButton";

type AnswerCardProps = {
  ans: QuestionAnswer;
  isBest: boolean;
  hasBestAnswer: boolean;
  isQuestionOwner: boolean;
  markRead: (answerId: string) => Promise<boolean | null>;
  onQuote?: () => void;
  currentUserId: string | null;
  questionRewardAmount: number;
  viewerPrice: number | null;
};

type CommentApiResponse = AnswerComment;

export default function AnswerCard({
  ans,
  isBest,
  hasBestAnswer,
  isQuestionOwner,
  markRead,
  onQuote,
  currentUserId,
  questionRewardAmount,
  viewerPrice,
}: AnswerCardProps) {
  const [likes, setLikes] = useState(ans.likeCount || 0);
  const [isLoading, setIsLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [comments, setComments] = useState<AnswerComment[]>(ans.comments ?? []);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [bestCheckoutLoading, setBestCheckoutLoading] = useState(false);
  const [answerContent, setAnswerContent] = useState(ans.content ?? "");
  const [editContent, setEditContent] = useState(ans.content ?? "");
  const [editing, setEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editNoAiConfirmed, setEditNoAiConfirmed] = useState(false);
  const [negotiatedAnswerContent, setNegotiatedAnswerContent] = useState("");
  const [negotiatedAnswerNoAi, setNegotiatedAnswerNoAi] = useState(false);
  const [negotiatedAnswerSaving, setNegotiatedAnswerSaving] = useState(false);
  const [negotiationSubmitted, setNegotiationSubmitted] = useState(
    Boolean(ans.negotiation?.submittedAt)
  );

  const authorName = useMemo(
    () => getPublicUserDisplayName(ans.user, ans.userId),
    [ans.user, ans.userId]
  );

  const canQuote =
    !!onQuote && !!currentUserId && ans.userId !== currentUserId && !ans.locked;
  const isAnswerOwner = !!currentUserId && ans.userId === currentUserId;
  const canViewComments = isQuestionOwner || isAnswerOwner;
  const canPostComment = canViewComments;
  const canManageNegotiation = isQuestionOwner;
  const canViewAcceptedNegotiationAnswer = isQuestionOwner || isAnswerOwner;
  const isLockedBest = isBest && ans.locked;
  const canViewBestContent = isBest && !ans.locked;

  const images = ans.images.filter(
    (image) => typeof image.url === "string" && image.url.length > 0
  );
  const negotiation = ans.negotiation;

  const status = negotiation?.status;
  const isPending = status === "PENDING";
  const isRejected = status === "REJECTED";
  const isAccepted = status === "ACCEPTED";
  const proposedAmount = negotiation ? Number(negotiation.proposedAmount) : null;
  const chargedAmount =
    proposedAmount !== null
      ? proposedAmount + Math.floor(proposedAmount * 0.1)
      : null;
  const bestViewBreakdown = getBestViewRevenueBreakdown(viewerPrice ?? 0);
  const shouldShowNegotiationManagement =
    !!negotiation && isPending && canManageNegotiation;
  const shouldShowPendingNegotiationNotice =
    !!negotiation && isPending && !canManageNegotiation && !canViewBestContent;
  const shouldShowRejectedNegotiationNotice =
    !!negotiation && isRejected && !canViewBestContent;
  const shouldShowAcceptedNegotiationContent =
    !!negotiation &&
    isAccepted &&
    negotiationSubmitted &&
    canViewAcceptedNegotiationAnswer &&
    !canViewBestContent;
  const shouldShowNegotiatedAnswerForm =
    !!negotiation && isAccepted && !negotiationSubmitted && isAnswerOwner;
  const shouldShowNegotiatedAnswerWaiting =
    !!negotiation && isAccepted && !negotiationSubmitted && isQuestionOwner;
  const shouldShowAcceptedNegotiationNotice =
    !!negotiation &&
    isAccepted &&
    !canViewAcceptedNegotiationAnswer &&
    !canViewBestContent;

  void markRead;

  if (ans.locked && !isBest) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 shadow-sm">
        <p className="text-sm font-semibold text-gray-700">回答済み</p>
      </div>
    );
  }

  const handleBest = async () => {
    try {
      const res = await fetch("/api/best", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answerId: ans.id,
          questionId: ans.questionId,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (data.success) {
        trackGA4BestSelected();
        window.location.reload();
      } else {
        alert(toJapaneseErrorMessage(data, "BEST設定に失敗しました"));
      }
    } catch (error) {
      alert(toJapaneseErrorMessage(error, "通信エラーが発生しました"));
    }
  };

  const handleLike = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const res = await fetch("/api/answers/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId: ans.id }),
      });

      const data = (await res.json()) as { likeCount?: number };
      if (data.likeCount !== undefined) setLikes(data.likeCount);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (commentLoading) return;

    const text = commentText.trim();
    if (!text) return;

    setCommentLoading(true);

    try {
      const res = await fetch("/api/comments/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId: ans.id, content: text }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        alert(toJapaneseErrorMessage(data, "コメント投稿に失敗しました"));
        return;
      }

      const newComment = (await res.json()) as CommentApiResponse;
      setCommentText("");
      setComments((prev) => [...prev, newComment]);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleRejectNegotiation = async () => {
    if (!negotiation?.id) {
      alert("交渉IDが見つかりません");
      return;
    }

    const ok = confirm("この回答提案を見送りますか？");
    if (!ok) return;

    try {
      const res = await fetch("/api/negotiations/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negotiationId: negotiation.id }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        alert(toJapaneseErrorMessage(err, "見送りに失敗しました"));
        return;
      }

      window.location.reload();
    } catch (error) {
      alert(toJapaneseErrorMessage(error, "通信エラーが発生しました"));
    }
  };

  const handleAcceptNegotiation = async () => {
    if (!negotiation?.id) {
      alert("交渉IDが見つかりません");
      return;
    }

    try {
      const res = await fetch("/api/checkout/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negotiationId: negotiation.id,
        }),
      });

      const data = (await res.json()) as { error?: string; url?: string };

      if (!res.ok) {
        alert(toJapaneseErrorMessage(data, "決済セッション作成に失敗しました"));
        return;
      }

      if (!data.url) {
        alert("決済URLが取得できませんでした");
        return;
      }

      trackGA4BeginCheckout({
        checkoutType: "negotiation_accept",
        amount: chargedAmount,
      });
      window.location.href = data.url;
    } catch (error) {
      alert(toJapaneseErrorMessage(error, "通信エラーが発生しました"));
    }
  };

  const handleBestViewCheckout = async () => {
    if (!viewerPrice || viewerPrice <= 0) {
      alert("この質問はBEST閲覧価格が未設定のため、購入を開始できません。");
      return;
    }

    if (bestCheckoutLoading) return;
    setBestCheckoutLoading(true);

    try {
      const res = await fetch("/api/best/view/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId: ans.id }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        url?: string;
      };

      if (!res.ok) {
        alert(toJapaneseErrorMessage(data, "決済セッション作成に失敗しました"));
        return;
      }

      if (!data.url) {
        alert("決済URLが取得できませんでした");
        return;
      }

      trackGA4BeginCheckout({
        checkoutType: "best_view",
        amount: viewerPrice,
      });
      window.location.href = data.url;
    } catch (error) {
      alert(toJapaneseErrorMessage(error, "通信エラーが発生しました"));
    } finally {
      setBestCheckoutLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (editSaving) return;
    setEditSaving(true);
    try {
      const response = await fetch(`/api/answers/${ans.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: editContent,
          noAiConfirmed: editNoAiConfirmed,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        answer?: { content?: string };
      };
      if (!response.ok || !data.answer?.content) {
        alert(toJapaneseErrorMessage(data, "回答の編集に失敗しました"));
        return;
      }
      setAnswerContent(data.answer.content);
      setEditContent(data.answer.content);
      setEditNoAiConfirmed(false);
      setEditing(false);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteAnswer = async () => {
    if (!window.confirm("この回答を削除しますか？削除後は元に戻せません。")) {
      return;
    }
    const response = await fetch(`/api/answers/${ans.id}`, { method: "DELETE" });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      alert(toJapaneseErrorMessage(data, "回答の削除に失敗しました"));
      return;
    }
    window.location.reload();
  };

  const handleSubmitNegotiatedAnswer = async () => {
    if (!negotiation || negotiatedAnswerSaving) return;
    setNegotiatedAnswerSaving(true);
    try {
      const response = await fetch(
        `/api/negotiations/${negotiation.id}/submit-answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: negotiatedAnswerContent,
            noAiConfirmed: negotiatedAnswerNoAi,
          }),
        }
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        content?: string;
      };
      if (!response.ok || !data.content) {
        alert(toJapaneseErrorMessage(data, "交渉回答の投稿に失敗しました"));
        return;
      }
      setAnswerContent(data.content);
      setNegotiationSubmitted(true);
    } finally {
      setNegotiatedAnswerSaving(false);
    }
  };

  const renderAnswerBody = () => (
    <>
      <div
        className="
          prose prose-sm max-w-none text-gray-800
          prose-p:leading-relaxed
          prose-headings:mt-4 prose-headings:mb-2
          prose-ul:my-2 prose-ol:my-2
          prose-pre:bg-gray-900 prose-pre:text-gray-100
          prose-pre:rounded
          prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
        "
      >
        <ReactMarkdown>{answerContent}</ReactMarkdown>
      </div>

      {images.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {images.map((img, index) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setLightboxIndex(index)}
              className="relative aspect-square w-full overflow-hidden rounded border transition hover:opacity-80"
            >
              <Image
                src={img.url}
                alt={`回答画像 ${index + 1}`}
                fill
                sizes="(max-width: 640px) 31vw, 180px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div
      className={`p-5 rounded-xl border shadow-sm ${
        isBest
          ? "bg-yellow-50 border-yellow-500 shadow-md"
          : "bg-white border-gray-200"
      }`}
    >
      {isBest && (
        <div className="mb-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-200 text-yellow-900 text-sm font-bold">
          <StarIcon className="w-4 h-4" />
          BEST回答
        </div>
      )}

      <div className="flex justify-between mb-3 items-center">
        <span className="text-sm text-gray-700">{authorName}</span>

        {isQuestionOwner &&
          (ans.reads?.length > 0 ? (
            <span className="text-xs text-blue-500 font-semibold">既読</span>
          ) : (
            <span className="text-xs text-gray-400">未読</span>
          ))}

        <span className="text-xs text-gray-500">
          {new Date(ans.createdAt).toLocaleString()}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          実体験ベース
        </span>
        {answerContent.trim().length >= 180 && (
          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700">
            詳細回答
          </span>
        )}
        {isBest && (
          <span className="rounded-full border border-yellow-300 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-800">
            BEST回答
          </span>
        )}
      </div>

      {isLockedBest ? (
        <div className="mt-3 p-4 rounded-lg border border-gray-300 bg-gray-50 text-sm text-gray-700">
          <div className="mb-3 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-3">
            <div className="font-semibold text-yellow-900">
              このBEST回答は有料公開されています
            </div>
            <p className="mt-1 text-xs leading-relaxed text-yellow-900/80">
              閲覧料金は質問者50%、BEST回答者20%、KnowValue運営30%で分配されます。
            </p>
          </div>
          <p className="mb-3">このBEST回答はロックされています。閲覧には購入が必要です。</p>
          {viewerPrice && viewerPrice > 0 ? (
            <p className="mb-3 font-semibold text-gray-900">
              閲覧価格：{viewerPrice.toLocaleString("ja-JP")}円
            </p>
          ) : (
            <p className="mb-3 text-red-600">
              この質問はBEST閲覧価格が未設定のため、現在は購入できません。
            </p>
          )}
          {currentUserId ? (
            <div>
              <button
                type="button"
                onClick={handleBestViewCheckout}
                disabled={bestCheckoutLoading || !viewerPrice || viewerPrice <= 0}
                className="px-4 py-2 rounded bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50"
              >
                {bestCheckoutLoading
                  ? "決済ページへ移動中..."
                  : viewerPrice && viewerPrice > 0
                    ? `${viewerPrice.toLocaleString("ja-JP")}円でBEST回答を閲覧する`
                    : "BEST回答を閲覧する"}
              </button>
              <p className="mt-2 text-xs leading-6 text-gray-500">
                決済に進むことで、
                <Link href="/terms" className="mx-1 text-blue-600 underline">
                  利用規約
                </Link>
                および
                <Link href="/refund-policy" className="mx-1 text-blue-600 underline">
                  返金ポリシー
                </Link>
                に同意したものとみなします。
              </p>
              {viewerPrice && viewerPrice > 0 && (
                <div className="mt-3 grid gap-2 rounded-lg border border-yellow-100 bg-white p-3 text-xs text-gray-600 sm:grid-cols-3">
                  <div>
                    <div className="text-gray-500">質問者への報酬</div>
                    <div className="font-semibold text-gray-900">
                      {bestViewBreakdown.questionOwnerAmount.toLocaleString("ja-JP")}円
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">BEST回答者への報酬</div>
                    <div className="font-semibold text-gray-900">
                      {bestViewBreakdown.answerOwnerAmount.toLocaleString("ja-JP")}円
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">プラットフォーム手数料</div>
                    <div className="font-semibold text-gray-900">
                      {bestViewBreakdown.platformFeeAmount.toLocaleString("ja-JP")}円
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href={`/login?redirectTo=${encodeURIComponent(`/questions/${ans.questionId}`)}`}
              className="inline-block px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-100"
            >
              ログインして購入する
            </Link>
          )}
        </div>
      ) : (
        <>
          {shouldShowNegotiationManagement && (
            <div className="mt-3 p-4 rounded-lg border border-purple-200 bg-purple-50">
              <div className="font-semibold text-purple-800 mb-2">
                回答提案（交渉カード）
              </div>

              <div className="text-sm text-gray-700 whitespace-pre-line">
                {ans.pitch || "（交渉用説明文がありません）"}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="px-3 py-1 rounded-full bg-purple-100 text-purple-900 font-bold">
                  追加報酬：{Number(negotiation.proposedAmount).toLocaleString("ja-JP")} 円
                </div>

                <div className="px-3 py-1 rounded-full bg-white text-purple-900 font-bold border border-purple-200">
                  決済額（10%利用料込）：
                  {chargedAmount !== null
                    ? `${chargedAmount.toLocaleString("ja-JP")} 円`
                    : "-"}
                </div>

                <button
                  type="button"
                  onClick={handleAcceptNegotiation}
                  disabled={chargedAmount === null || chargedAmount <= 0}
                  className="px-4 py-2 rounded bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-50"
                >
                  {chargedAmount !== null && chargedAmount > 0
                    ? `${chargedAmount.toLocaleString("ja-JP")}円を支払って承認`
                    : "決済できません"}
                </button>

                <button
                  type="button"
                  onClick={handleRejectNegotiation}
                  className="px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50"
                >
                  今回は見送る
                </button>
              </div>

              <div className="mt-2 text-xs text-gray-500">
                {chargedAmount !== null && chargedAmount > 0
                  ? `※ 元の質問報酬${questionRewardAmount.toLocaleString("ja-JP")}円とは別に決済します。回答者には回答投稿後、追加報酬の90%が付与されます`
                  : "※ 追加報酬額を確認できません"}
              </div>
              {chargedAmount !== null && chargedAmount > 0 && (
                <p className="mt-2 text-xs leading-6 text-gray-500">
                  決済に進むことで、
                  <Link href="/terms" className="mx-1 text-blue-600 underline">
                    利用規約
                  </Link>
                  および
                  <Link href="/refund-policy" className="mx-1 text-blue-600 underline">
                    返金ポリシー
                  </Link>
                  に同意したものとみなします。
                </p>
              )}
            </div>
          )}

          {canViewBestContent ? (
            renderAnswerBody()
          ) : shouldShowNegotiatedAnswerForm ? (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="font-semibold text-green-900">
                追加報酬の提案が承認されました
              </div>
              <p className="mt-1 text-xs text-green-800">
                期限: {negotiation?.answerDueAt
                  ? new Date(negotiation.answerDueAt).toLocaleString("ja-JP")
                  : "確認中"}
              </p>
              <textarea
                value={negotiatedAnswerContent}
                onChange={(event) => setNegotiatedAnswerContent(event.target.value)}
                rows={8}
                className="mt-3 w-full rounded border border-green-200 bg-white p-3 text-sm text-gray-900"
                placeholder="承認された条件に基づく回答を入力してください"
              />
              <label className="mt-2 flex items-start gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={negotiatedAnswerNoAi}
                  onChange={(event) => setNegotiatedAnswerNoAi(event.target.checked)}
                  className="mt-0.5"
                />
                AIによる生成・要約・翻訳・校正・編集を使用していません
              </label>
              <button
                type="button"
                onClick={handleSubmitNegotiatedAnswer}
                disabled={
                  negotiatedAnswerSaving ||
                  !negotiatedAnswerContent.trim() ||
                  !negotiatedAnswerNoAi
                }
                className="mt-3 rounded bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {negotiatedAnswerSaving ? "投稿中..." : "回答を投稿して追加報酬を確定"}
              </button>
            </div>
          ) : shouldShowNegotiatedAnswerWaiting ? (
            <div className="mt-3 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              追加報酬の決済が完了しました。回答者の投稿期限は
              {negotiation?.answerDueAt
                ? new Date(negotiation.answerDueAt).toLocaleString("ja-JP")
                : "確認中"}
              です。
            </div>
          ) : shouldShowPendingNegotiationNotice ? (
            <div className="mt-3 p-4 rounded-lg border border-purple-200 bg-purple-50">
              <div className="font-semibold text-purple-800 mb-2">
                回答提案（交渉カード）
              </div>

              <div className="text-sm text-gray-700 whitespace-pre-line">
                {ans.pitch || "（交渉用説明文がありません）"}
              </div>

              {isAnswerOwner ? (
                <div className="mt-3 text-sm text-purple-900">
                  交渉状態：質問オーナーの承認待ちです。
                </div>
              ) : (
                <div className="mt-3 text-sm text-purple-900">
                  交渉中の回答です。
                </div>
              )}
            </div>
          ) : shouldShowRejectedNegotiationNotice ? (
            <div className="mt-3 p-3 rounded border bg-gray-50 text-sm text-gray-600">
              この回答提案は見送り済みです。
            </div>
          ) : shouldShowAcceptedNegotiationContent ? (
            <>
              <div className="mt-3 p-3 rounded border bg-green-50 text-sm text-green-700">
                購入済み（回答済み）です。
              </div>
              {renderAnswerBody()}
            </>
          ) : shouldShowAcceptedNegotiationNotice ? (
            <div className="mt-3 p-3 rounded border bg-green-50 text-sm text-green-700">
              この回答提案は承諾済みです（購入済み）。
            </div>
          ) : (
            renderAnswerBody()
          )}
        </>
      )}

      {!ans.locked && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!isAnswerOwner && (
            <button
              type="button"
              disabled={isLoading}
              onClick={handleLike}
              className="text-sm px-3 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              👍 参考になった <span className="ml-1 text-gray-700">{likes}</span>
            </button>
          )}

          {canQuote && (
            <button
              type="button"
              onClick={onQuote}
              className="text-sm px-3 py-1 rounded border bg-white hover:bg-gray-50 text-blue-600"
            >
              引用して回答
            </button>
          )}
        </div>
      )}

      {isAnswerOwner && !hasBestAnswer && !ans.locked && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          {editing ? (
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={(event) => setEditContent(event.target.value)}
                rows={8}
                className="w-full rounded border border-gray-300 bg-white p-3 text-sm text-gray-900"
              />
              <label className="flex items-start gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={editNoAiConfirmed}
                  onChange={(event) =>
                    setEditNoAiConfirmed(event.target.checked)
                  }
                  className="mt-0.5"
                />
                AIによる生成・要約・翻訳・校正・編集を使用していません
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={
                    editSaving || !editContent.trim() || !editNoAiConfirmed
                  }
                  className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {editSaving ? "保存中..." : "変更を保存"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditContent(answerContent);
                    setEditing(false);
                  }}
                  className="rounded border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                回答を編集
              </button>
              <button
                type="button"
                onClick={handleDeleteAnswer}
                className="rounded border border-red-300 bg-white px-3 py-2 text-sm text-red-700"
              >
                回答を削除
              </button>
            </div>
          )}
        </div>
      )}

      {currentUserId && !isAnswerOwner && !ans.locked && (
        <ReportButton targetType="answer" targetId={ans.id} />
      )}

      {isQuestionOwner && isBest && (
        <div className="mt-4">
          <button
            type="button"
            disabled
            className="inline-flex cursor-default items-center gap-2 rounded-full border border-yellow-300 bg-yellow-100 px-4 py-2 text-sm font-semibold text-yellow-900"
          >
            <StarIcon className="h-5 w-5" />
            BEST回答
          </button>
        </div>
      )}

      {isQuestionOwner && !isBest && !hasBestAnswer && (
        <div className="mt-4">
          <button
            type="button"
            onClick={handleBest}
            className="inline-flex items-center gap-2 rounded-full border border-yellow-500 bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <StarIcon className="h-5 w-5" />
            <span>BEST回答に選ぶ</span>
          </button>
        </div>
      )}

      {lightboxIndex !== null && images.length > 0 && (
        <ImageLightbox
          images={images.map((img) => img.url)}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() =>
            setLightboxIndex((lightboxIndex - 1 + images.length) % images.length)
          }
          onNext={() => setLightboxIndex((lightboxIndex + 1) % images.length)}
        />
      )}

      {!ans.locked && canViewComments && (
        <>
          <div className="mt-4 space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="text-sm bg-gray-50 p-2 rounded">
                <span className="font-semibold">
                  {getPublicUserDisplayName(comment.user, comment.user?.id)}
                </span>
                <span className="text-gray-600 ml-2">{comment.content}</span>
                <span className="text-xs text-gray-400 ml-2">
                  {new Date(comment.createdAt).toLocaleString()}
                </span>
                {currentUserId && comment.user?.id !== currentUserId && (
                  <ReportButton targetType="comment" targetId={comment.id} />
                )}
              </div>
            ))}
          </div>

          {canPostComment && (
            <>
              <p className="mt-3 text-xs text-gray-500">
                ※コメントは質問者と回答者のみ投稿できます
              </p>
              <form onSubmit={handleAddComment} className="mt-2 flex gap-2">
                <input
                  type="text"
                  name="comment"
                  placeholder="コメントを書く..."
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={commentLoading}
                  className="px-3 py-1 rounded bg-gray-900 text-white text-sm disabled:opacity-50"
                >
                  {commentLoading ? "送信中" : "送信"}
                </button>
              </form>
            </>
          )}
        </>
      )}
    </div>
  );
}
