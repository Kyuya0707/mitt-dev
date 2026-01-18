// app/questions/[id]/AnswerCard.tsx
"use client";

import { useMemo, useState } from "react";
import ImageLightbox from "./ImageLightbox";
import { StarIcon } from "@heroicons/react/24/solid";
import ReactMarkdown from "react-markdown";

type NegotiationStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export default function AnswerCard({
  ans,
  isBest,
  isAuthor,
  markRead,
  onQuote,
  currentUserId,
}: any) {
  const [likes, setLikes] = useState(ans.likeCount || 0);
  const [isLoading, setIsLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // ✅ コメント：リロードなしで反映
  const [comments, setComments] = useState<any[]>(ans.comments || []);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  // ✅ 表示名（answers.include.user が必要）
  const authorName = useMemo(() => {
    return (
      ans.user?.name ||
      ans.user?.user_metadata?.username ||
      ans.user?.email ||
      "User"
    );
  }, [ans.user]);

  // ✅ 自分の回答には引用ボタンを出さない
  const canQuote = !!onQuote && !!currentUserId && ans.userId !== currentUserId;

  const images = ans.images || [];

  // ✅ 交渉（MVP）
  const negotiation = ans.negotiation as
    | { id: string; proposedAmount: number; status: NegotiationStatus }
    | undefined;

  const status = negotiation?.status;
  const isPending = status === "PENDING";
  const isRejected = status === "REJECTED";
  const isAccepted = status === "ACCEPTED";

  /* =========================================================
     ★ BEST設定処理（API 経由）
  ========================================================= */
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

      const data = await res.json();
      if (data.success) window.location.reload();
      else alert("BEST設定に失敗しました");
    } catch (e) {
      console.error(e);
      alert("通信エラーが発生しました");
    }
  };

  /* =========================================================
     ★ いいね処理
  ========================================================= */
  const handleLike = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const res = await fetch("/api/answers/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId: ans.id }),
      });

      const data = await res.json();
      if (data.likeCount !== undefined) setLikes(data.likeCount);
    } finally {
      setIsLoading(false);
    }
  };

  /* =========================================================
     ★ コメント追加（リロードなし / API返却を反映）
  ========================================================= */
  const handleAddComment = async (e: React.FormEvent) => {
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
        alert("コメント投稿に失敗しました");
        return;
      }

      const newComment = await res.json();
      setCommentText("");
      setComments((prev) => [...prev, newComment]);
    } finally {
      setCommentLoading(false);
    }
  };

  /* =========================================================
     ★ 交渉：見送り（API側で権限チェックする）
  ========================================================= */
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
        const err = await res.json().catch(() => ({}));
        alert(err.error || "見送りに失敗しました");
        return;
      }

      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("通信エラーが発生しました");
    }
  };

  /* =========================================================
     ★ 交渉：承諾 → Stripeへ
  ========================================================= */
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

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "決済セッション作成に失敗しました");
        return;
      }

      if (!data.url) {
        alert("決済URLが取得できませんでした");
        return;
      }

      window.location.href = data.url;
    } catch (e) {
      console.error(e);
      alert("通信エラーが発生しました");
    }
  };

  return (
    <div
      className={`p-5 rounded-xl border shadow-sm ${
        isBest
          ? "bg-yellow-50 border-yellow-500 shadow-md"
          : "bg-white border-gray-200"
      }`}
    >
      {/* BESTバッジ */}
      {isBest && (
        <div className="mb-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-200 text-yellow-900 text-sm font-bold">
          <StarIcon className="w-4 h-4" />
          BEST回答
        </div>
      )}

      {/* ヘッダー */}
      <div className="flex justify-between mb-3 items-center">
        <span className="text-sm text-gray-700">{authorName}</span>

        {isAuthor &&
          (ans.reads?.length > 0 ? (
            <span className="text-xs text-blue-500 font-semibold">既読</span>
          ) : (
            <span className="text-xs text-gray-400">未読</span>
          ))}

        <span className="text-xs text-gray-500">
          {new Date(ans.createdAt).toLocaleString()}
        </span>
      </div>

      {/* ✅ 本文 or 交渉カード */}
      {negotiation && isPending ? (
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

            <button
              type="button"
              onClick={handleAcceptNegotiation}
              className="px-4 py-2 rounded bg-purple-700 text-white hover:bg-purple-800"
            >
              この金額で続きを読む
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
            ※ 本回答は決済完了後に公開されます
          </div>
        </div>
      ) : negotiation && isRejected ? (
        <div className="mt-3 p-3 rounded border bg-gray-50 text-sm text-gray-600">
          この回答提案は見送り済みです。
        </div>
      ) : negotiation && isAccepted ? (
        isAuthor ? (
          <>
            <div className="mt-3 p-3 rounded border bg-green-50 text-sm text-green-700">
              購入済み（解凍済み）です。
            </div>

            <div
              className="
                mt-3
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
                {images.map((img: any, index: number) => (
                  <img
                    key={img.id}
                    src={img.url}
                    onClick={() => setLightboxIndex(index)}
                    className="w-full aspect-square object-cover rounded cursor-pointer hover:opacity-80 transition border"
                    alt="answer image"
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="mt-3 p-3 rounded border bg-green-50 text-sm text-green-700">
            この回答提案は承諾済みです（購入済み）。
          </div>
        )
      ) : (
        <>
          {/* Markdown本文 */}
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

          {/* 画像（本文表示のときだけ） */}
          {images.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {images.map((img: any, index: number) => (
                <img
                  key={img.id}
                  src={img.url}
                  onClick={() => setLightboxIndex(index)}
                  className="w-full aspect-square object-cover rounded cursor-pointer hover:opacity-80 transition border"
                  alt="answer image"
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* いいね / 引用 */}
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

      {/* BEST操作（BESTじゃない時だけ） */}
      {!isBest && (
        <div className="mt-4">
          <button
            type="button"
            onClick={handleBest}
            className="flex items-center gap-1 text-gray-600 hover:text-yellow-500 transition transform hover:scale-110"
          >
            <StarIcon className="w-5 h-5" />
            <span className="text-sm">BEST にする</span>
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && images.length > 0 && (
        <ImageLightbox
          images={images.map((img: any) => img.url)}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() =>
            setLightboxIndex((lightboxIndex - 1 + images.length) % images.length)
          }
          onNext={() => setLightboxIndex((lightboxIndex + 1) % images.length)}
        />
      )}

      {/* コメント一覧 */}
      <div className="mt-4 space-y-3">
        {comments.map((c: any) => (
          <div key={c.id} className="text-sm bg-gray-50 p-2 rounded">
            <span className="font-semibold">
              {c.user?.name || c.user?.user_metadata?.username || "User"}
            </span>
            <span className="text-gray-600 ml-2">{c.content}</span>
            <span className="text-xs text-gray-400 ml-2">
              {new Date(c.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {/* コメント投稿（リロード無し） */}
      <form onSubmit={handleAddComment} className="mt-3 flex gap-2">
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
    </div>
  );
}
