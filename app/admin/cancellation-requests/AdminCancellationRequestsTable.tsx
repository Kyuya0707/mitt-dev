"use client";

import { useEffect, useState } from "react";

type CancellationRequestRow = {
  id: string;
  status: string;
  reason: string | null;
  adminNote: string | null;
  stripeRefundId: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  question: {
    id: string;
    title: string;
    createdAt: string;
    rewardAmount: number;
    checkoutAmount: number;
    answerCount: number;
    purchaseId: string | null;
    stripeSessionId: string | null;
    purchaseStatus: string | null;
  };
  requester: {
    id: string;
    username: string | null;
    email: string;
    displayId: string | null;
  };
};

function formatYen(value: number) {
  return `${value.toLocaleString("ja-JP")}円`;
}

export default function AdminCancellationRequestsTable() {
  const [requests, setRequests] = useState<CancellationRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/cancellation-requests", {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        requests?: CancellationRequestRow[];
        error?: string;
      };

      if (!res.ok) {
        setError(data.error || "キャンセル申請一覧の取得に失敗しました。");
        setRequests([]);
        return;
      }

      setRequests(data.requests ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const handleApprove = async (requestId: string) => {
    const ok = window.confirm("このキャンセル申請を承認して返金しますか？");
    if (!ok) {
      return;
    }

    setProcessingId(requestId);
    setMessage("");
    setError("");

    try {
      const res = await fetch(
        `/api/admin/cancellation-requests/${requestId}/approve`,
        {
          method: "POST",
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!res.ok) {
        setError(data.error || "承認に失敗しました。");
        await loadRequests();
        return;
      }

      setMessage("キャンセル申請を承認し、返金処理を実行しました");
      await loadRequests();
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    const adminNote = window.prompt("却下理由や運営メモがあれば入力してください", "") ?? "";
    const ok = window.confirm("このキャンセル申請を却下しますか？");
    if (!ok) {
      return;
    }

    setProcessingId(requestId);
    setMessage("");
    setError("");

    try {
      const res = await fetch(
        `/api/admin/cancellation-requests/${requestId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adminNote: adminNote.trim() || null }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!res.ok) {
        setError(data.error || "却下に失敗しました。");
        await loadRequests();
        return;
      }

      setMessage("キャンセル申請を却下しました");
      await loadRequests();
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">読み込み中...</p>;
  }

  return (
    <div>
      {message && (
        <div className="mb-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <p className="text-sm text-gray-500">pending のキャンセル申請はありません。</p>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const requesterName =
              request.requester.username ||
              request.requester.displayId ||
              request.requester.email;

            return (
              <div
                key={request.id}
                className="rounded border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="grid gap-2 text-sm text-gray-800 md:grid-cols-2">
                  <p>
                    <span className="font-semibold">質問タイトル:</span>{" "}
                    {request.question.title}
                  </p>
                  <p>
                    <span className="font-semibold">質問者:</span> {requesterName}
                  </p>
                  <p>
                    <span className="font-semibold">報酬額:</span>{" "}
                    {formatYen(request.question.rewardAmount)}
                  </p>
                  <p>
                    <span className="font-semibold">決済額:</span>{" "}
                    {formatYen(request.question.checkoutAmount)}
                  </p>
                  <p>
                    <span className="font-semibold">回答数:</span>{" "}
                    {request.question.answerCount}件
                  </p>
                  <p>
                    <span className="font-semibold">投稿日時:</span>{" "}
                    {new Date(request.question.createdAt).toLocaleString("ja-JP")}
                  </p>
                  <p>
                    <span className="font-semibold">申請日時:</span>{" "}
                    {new Date(request.requestedAt).toLocaleString("ja-JP")}
                  </p>
                  <p>
                    <span className="font-semibold">Stripe Session:</span>{" "}
                    {request.question.stripeSessionId ?? "未保存"}
                  </p>
                </div>

                {request.reason && (
                  <p className="mt-3 text-sm text-gray-700">
                    <span className="font-semibold">申請理由:</span> {request.reason}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleApprove(request.id)}
                    disabled={processingId === request.id}
                    className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {processingId === request.id ? "処理中..." : "承認して返金"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(request.id)}
                    disabled={processingId === request.id}
                    className="rounded border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 disabled:opacity-50"
                  >
                    却下する
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
