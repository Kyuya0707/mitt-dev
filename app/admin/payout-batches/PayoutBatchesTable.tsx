"use client";

import { useEffect, useState } from "react";

type Batch = {
  id: string;
  createdAt: string;
  periodKey: string;
  amount: number;
  status: string;
  transferredAt: string | null;
  failureReason: string | null;
  items: Array<{ id: string }>;
  user: {
    email: string;
    username: string | null;
    stripeAccountId: string | null;
    stripeConnectPayoutsEnabled: boolean;
    stripeConnectDetailsSubmitted: boolean;
  };
};

export default function PayoutBatchesTable() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/admin/payout-batches", { cache: "no-store" });
    const data = (await response.json().catch(() => ({}))) as {
      batches?: Batch[];
      error?: string;
    };
    if (!response.ok) setError(data.error ?? "振込予定の取得に失敗しました");
    else setBatches(data.batches ?? []);
    setLoading(false);
  }

  // Initial data is loaded from the authenticated admin API after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);

  async function transfer(id: string) {
    setProcessingId(id);
    setMessage("");
    setError("");
    const response = await fetch(`/api/admin/payout-batches/${id}/transfer`, { method: "POST" });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) setError(data.error ?? "振込に失敗しました");
    else setMessage("月次一括振込が完了しました");
    await load();
    setProcessingId(null);
  }

  if (loading) return <p className="text-sm text-gray-500">読み込み中...</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        毎月1日に前月末までの報酬をユーザー別に集計し、合計5,000円以上だけを表示します。
      </p>
      {message && <p className="rounded bg-green-50 p-3 text-sm text-green-800">{message}</p>}
      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {batches.length === 0 ? (
        <p className="text-sm text-gray-500">振込予定はありません。</p>
      ) : batches.map((batch) => {
        const ready = Boolean(batch.user.stripeAccountId) &&
          batch.user.stripeConnectPayoutsEnabled &&
          batch.user.stripeConnectDetailsSubmitted;
        const transferable = ["scheduled", "failed"].includes(batch.status) && ready;
        return (
          <div key={batch.id} className="rounded border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <p><strong>対象月:</strong> {batch.periodKey}</p>
              <p><strong>状態:</strong> {batch.status}</p>
              <p><strong>受取人:</strong> {batch.user.username ?? batch.user.email}</p>
              <p><strong>明細数:</strong> {batch.items.length}件</p>
              <p><strong>振込額:</strong> {batch.amount.toLocaleString("ja-JP")}円</p>
              <p><strong>Connect:</strong> {ready ? "送金可能" : "設定未完了"}</p>
              {batch.failureReason && <p className="text-red-700 md:col-span-2">失敗理由: {batch.failureReason}</p>}
            </div>
            <button
              type="button"
              disabled={!transferable || processingId === batch.id}
              onClick={() => void transfer(batch.id)}
              className="mt-4 rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              {processingId === batch.id ? "処理中..." : batch.status === "paid" ? "振込済み" : "一括振込を実行"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
