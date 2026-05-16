"use client";

import { useState } from "react";
import { trackGA4BeginCheckout } from "@/lib/ga";

type QuestionRepurchaseButtonProps = {
  questionId: string;
  checkoutAmount?: number | null;
};

export default function QuestionRepurchaseButton({
  questionId,
  checkoutAmount,
}: QuestionRepurchaseButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/checkout/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        url?: string;
      };

      if (!res.ok) {
        alert(data.error || "決済の開始に失敗しました");
        return;
      }

      if (!data.url) {
        alert("決済URLが取得できませんでした");
        return;
      }

      trackGA4BeginCheckout({
        checkoutType: "question_post",
        amount: checkoutAmount,
      });
      window.location.href = data.url;
    } catch {
      alert("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCheckout}
      disabled={loading}
      className="inline-flex items-center rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {loading ? "決済ページへ移動中..." : "再度決済して質問を公開する"}
    </button>
  );
}
