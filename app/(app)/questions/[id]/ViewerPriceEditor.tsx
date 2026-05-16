"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_VIEWER_PRICE_JPY } from "@/lib/viewer-price";

type ViewerPriceEditorProps = {
  questionId: string;
  initialViewerPrice: number | null;
};

export default function ViewerPriceEditor({
  questionId,
  initialViewerPrice,
}: ViewerPriceEditorProps) {
  const router = useRouter();
  const [viewerPrice, setViewerPrice] = useState<number>(initialViewerPrice ?? 0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    if (!Number.isFinite(viewerPrice) || !Number.isInteger(viewerPrice) || viewerPrice < 1) {
      setError("BEST閲覧価格は1円以上の整数で入力してください");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewerPrice }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        viewerPrice?: number;
      };

      if (!res.ok) {
        setError(data.error ?? "viewerPriceの保存に失敗しました");
        return;
      }

      setViewerPrice(data.viewerPrice ?? viewerPrice);
      setMessage("BEST閲覧価格を更新しました");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 p-4 rounded border bg-gray-50">
      <div className="font-semibold mb-2">BEST閲覧価格（質問者のみ編集可）</div>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          type="number"
          className="border rounded px-3 py-2 w-full sm:w-56"
          value={viewerPrice}
          onChange={(e) => setViewerPrice(Number(e.target.value))}
          min={1}
          max={MAX_VIEWER_PRICE_JPY}
          step={1}
          required
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        1円〜{MAX_VIEWER_PRICE_JPY.toLocaleString("ja-JP")}円で設定できます。
      </p>
      {message && <p className="text-sm text-green-700 mt-2">{message}</p>}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
