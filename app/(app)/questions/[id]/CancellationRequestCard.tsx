"use client";

import { useState } from "react";
import { toJapaneseErrorMessage } from "@/lib/errors";

type CancellationRequestCardProps = {
  questionId: string;
  canRequest: boolean;
  isOldEnough: boolean;
  existingStatus: "pending" | "approved" | "rejected" | null;
  requestedAt: string | null;
  adminNote: string | null;
};

export default function CancellationRequestCard({
  questionId,
  canRequest,
  isOldEnough,
  existingStatus,
  requestedAt,
  adminNote,
}: CancellationRequestCardProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentStatus, setCurrentStatus] = useState(existingStatus);

  const handleSubmit = async () => {
    const ok = window.confirm(
      "キャンセル申請を送信しますか？運営が確認し、承認された場合に返金処理を行います。"
    );
    if (!ok) {
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/questions/${questionId}/cancel-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || null }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        setError(
          toJapaneseErrorMessage(data, "キャンセル申請の送信に失敗しました")
        );
        return;
      }

      setCurrentStatus("pending");
      setMessage(data.message ?? "キャンセル申請を受け付けました。");
    } catch (requestError) {
      setError(
        toJapaneseErrorMessage(
          requestError,
          "キャンセル申請の送信に失敗しました"
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-black">
      <div className="font-semibold text-red-900">質問のキャンセル申請</div>
      <p className="mt-2 text-sm leading-relaxed text-red-900/80">
        質問投稿から1週間経過後、キャンセル申請ができます。申請後、運営が内容を確認し、
        承認された場合に返金処理を行います。
      </p>

      {currentStatus === "pending" ? (
        <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-3 text-sm text-yellow-900">
          キャンセル申請中です。
          {requestedAt && (
            <div className="mt-1 text-xs text-yellow-800/80">
              申請日時: {new Date(requestedAt).toLocaleString("ja-JP")}
            </div>
          )}
        </div>
      ) : currentStatus === "approved" ? (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-900">
          この質問のキャンセル申請は承認済みです。
        </div>
      ) : (
        <>
          {!isOldEnough && (
            <div className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700">
              キャンセル申請は投稿から1週間経過後に可能になります。
            </div>
          )}

          {existingStatus === "rejected" && (
            <div className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700">
              前回の申請は却下されています。
              {adminNote && (
                <div className="mt-1 text-xs text-gray-500">運営メモ: {adminNote}</div>
              )}
            </div>
          )}

          {canRequest && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">
                  申請理由（任意）
                </label>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                  placeholder="回答が集まらない理由や、キャンセルを希望する背景があれば入力してください"
                />
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? "申請中..." : "キャンセル申請する"}
              </button>
            </div>
          )}
        </>
      )}

      {message && (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800">
          {message}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
    </div>
  );
}
