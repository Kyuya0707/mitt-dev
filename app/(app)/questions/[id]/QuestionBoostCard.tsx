"use client";

import { useState } from "react";

export default function QuestionBoostCard({
  questionId,
  rewardAmount,
  boostCount,
}: {
  questionId: string;
  rewardAmount: number;
  boostCount: number;
}) {
  const [shortenDeadline, setShortenDeadline] = useState(false);
  const [loading, setLoading] = useState(false);
  const amount = Math.floor(rewardAmount * 0.1);

  const checkout = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/boost/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, shortenDeadline }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        url?: string;
      };
      if (!response.ok || !data.url) {
        alert(data.error || "Boost決済を開始できませんでした");
        return;
      }
      window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4">
      <div className="font-semibold text-orange-950">質問をBoostする</div>
      <p className="mt-2 text-sm leading-6 text-orange-900">
        {amount.toLocaleString("ja-JP")}円で3日間、質問一覧の上部へ強調表示します（{boostCount}/3回利用済み）。
      </p>
      <label className="mt-3 flex items-start gap-2 text-sm text-orange-900">
        <input
          type="checkbox"
          checked={shortenDeadline}
          onChange={(event) => setShortenDeadline(event.target.checked)}
          className="mt-1"
        />
        現在の期限が7日より先の場合、回答期限を決済時点から7日後へ短縮する
      </label>
      <button
        type="button"
        onClick={checkout}
        disabled={loading}
        className="mt-3 rounded bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? "決済ページへ移動中..." : "Boostを購入"}
      </button>
    </div>
  );
}
