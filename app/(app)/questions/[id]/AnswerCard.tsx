// app/questions/[id]/AnswerCard.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ImageLightbox from "./ImageLightbox";
import { StarIcon } from "@heroicons/react/24/solid";
import ReactMarkdown from "react-markdown";
import type { AnswerComment, QuestionAnswer } from "./types";
import { getPublicUserDisplayName } from "@/lib/public-user-display";
import { toJapaneseErrorMessage } from "@/lib/errors";
import { getBestViewRevenueBreakdown } from "@/lib/best-view-breakdown";

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
    proposedAmount !== null ? proposedAmount - questionRewardAmount : null;
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
    canViewAcceptedNegotiationAnswer &&
    !canViewBestContent;
  const shouldShowAcceptedNegotiationNotice =
    !!negotiation &&
    isAccepted &&
    !canViewAcceptedNegotiationAnswer &&
    !canViewBestContent;

  void markRead;

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
      if (data.success) window.location.reload();
      else alert(toJapaneseErrorMessage(data, "BEST設定に失敗しました"));
    } catch (error) {
      console.error(error);
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
      console.error(error);
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

      window.location.href = data.url;
    } catch (error) {
      console.error(error);
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

      window.location.href = data.url;
    } catch (error) {
      console.error(error);
      alert(toJapaneseErrorMessage(error, "通信エラーが発生しました"));
    } finally {
      setBestCheckoutLoading(false);
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
        <ReactMarkdown>{ans.content ?? ""}</ReactMarkdown>
      </div>

      {images.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {images.map((img, index) => (
            <img
              key={img.id}
              src={img.url}
              onClick={() => setLightboxIndex(index)}
              className="w-full aspect-square object-cover rounded cursor-pointer hover:opacity-80 transition border"
              alt={`answer image ${index + 1}`}
            />
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

      {isLockedBest ? (
        <div className="mt-3 p-4 rounded-lg border border-gray-300 bg-gray-50 text-sm text-gray-700">
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
                    <div className="text-gray-500">回答者への報酬</div>
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
                  提案額：{Number(negotiation.proposedAmount).toLocaleString("ja-JP")} 円
                </div>

                <div className="px-3 py-1 rounded-full bg-white text-purple-900 font-bold border border-purple-200">
                  追加支払い：
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
                    ? `追加で${chargedAmount.toLocaleString("ja-JP")}円支払う`
                    : "追加決済は不要です"}
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
                  ? `※ 元の報酬額 ${questionRewardAmount.toLocaleString("ja-JP")}円 は支払い済みです。差額のみ追加決済されます`
                  : "※ 提案額が元の報酬額以下のため、追加決済はできません"}
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isLoading}
          onClick={handleLike}
          className="text-sm px-3 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          👍 いいね <span className="ml-1 text-gray-700">{likes}</span>
        </button>

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
