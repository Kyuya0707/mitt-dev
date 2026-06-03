"use client";

import { useEffect, useState } from "react";

type AdminPayoutRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  questionId: string | null;
  answerId: string | null;
  negotiationId: string | null;
  kind: string;
  description: string | null;
  grossAmount: number | null;
  platformFeeAmount: number | null;
  netAmount: number | null;
  amount: number;
  currency: string;
  status: string;
  stripeAccountId: string | null;
  stripeTransferId: string | null;
  transferredAt: string | null;
  failureReason: string | null;
  user: {
    id: string;
    email: string;
    username: string | null;
    stripeAccountId: string | null;
    stripeConnectPayoutsEnabled: boolean;
    stripeConnectDetailsSubmitted: boolean;
  };
  question: {
    id: string;
    title: string;
  } | null;
  answer: {
    id: string;
    questionId: string;
  } | null;
};

export default function AdminPayoutsTable() {
  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "未送金";
      case "processing":
        return "処理中";
      case "paid":
        return "送金済み";
      case "failed":
        return "失敗";
      default:
        return status;
    }
  };

  const shortenStripeAccountId = (value: string | null) => {
    if (!value) {
      return "未設定";
    }

    if (value.length <= 14) {
      return value;
    }

    return `${value.slice(0, 8)}...${value.slice(-4)}`;
  };

  const getConnectStatusText = (value: boolean) => (value ? "完了" : "未完");
  const formatYen = (value: number) => `${value.toLocaleString("ja-JP")}円`;
  const getPayoutKindLabel = (kind: string) => {
    switch (kind) {
      case "question_reward":
        return "質問報酬";
      case "negotiation_reward":
        return "交渉追加報酬";
      default:
        return kind;
    }
  };

  const loadPayouts = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/payouts", {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        payouts?: AdminPayoutRow[];
        error?: string;
      };

      if (!res.ok) {
        setError(data.error || "Payout 一覧の取得に失敗しました。");
        setPayouts([]);
        return;
      }

      setPayouts(data.payouts ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPayouts();
  }, []);

  const handleTransfer = async (payoutId: string) => {
    setProcessingId(payoutId);
    setMessage("");
    setError("");

    try {
      const res = await fetch(`/api/admin/payouts/${payoutId}/transfer`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!res.ok) {
        setError(data.error || "送金に失敗しました。");
        await loadPayouts();
        return;
      }

      setMessage("送金が完了しました");
      await loadPayouts();
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

      {payouts.length === 0 ? (
        <p className="text-sm text-gray-500">未処理の Payout はありません。</p>
      ) : (
        <div className="space-y-4">
          {payouts.map((payout) => {
              const displayName =
                payout.user.username || payout.user.email || payout.user.id;
            const grossAmount = payout.grossAmount ?? payout.amount;
            const platformFeeAmount = payout.platformFeeAmount ?? 0;
            const netAmount = payout.netAmount ?? payout.amount;
            const destinationStripeAccountId =
              payout.stripeAccountId ?? payout.user.stripeAccountId;
            const canTransfer =
              Boolean(destinationStripeAccountId) &&
              payout.user.stripeConnectPayoutsEnabled &&
              payout.user.stripeConnectDetailsSubmitted &&
              payout.status !== "processing" &&
              payout.status !== "paid" &&
              !payout.stripeTransferId;

            return (
              <div
                key={payout.id}
                className="rounded border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="grid gap-2 text-sm text-gray-800 md:grid-cols-2">
                  <p>
                    <span className="font-semibold">作成日:</span>{" "}
                    {new Date(payout.createdAt).toLocaleString("ja-JP")}
                  </p>
                  <p>
                    <span className="font-semibold">種別:</span>{" "}
                    {getPayoutKindLabel(payout.kind)}
                  </p>
                  <p>
                    <span className="font-semibold">status:</span>{" "}
                    {getStatusLabel(payout.status)}
                  </p>
                  {payout.description && (
                    <p className="md:col-span-2">
                      <span className="font-semibold">説明:</span>{" "}
                      {payout.description}
                    </p>
                  )}
                  <p>
                    <span className="font-semibold">回答者:</span> {displayName}
                  </p>
                  <p>
                    <span className="font-semibold">email:</span> {payout.user.email}
                  </p>
                  <p>
                    <span className="font-semibold">amount:</span>{" "}
                    {formatYen(netAmount)}
                  </p>
                  <p>
                    <span className="font-semibold">Connect状態:</span>{" "}
                    detailsSubmitted={getConnectStatusText(
                      payout.user.stripeConnectDetailsSubmitted
                    )}{" "}
                    / payoutsEnabled={getConnectStatusText(
                      payout.user.stripeConnectPayoutsEnabled
                    )}
                  </p>
                  <p>
                    <span className="font-semibold">Payout stripeAccountId:</span>{" "}
                    {shortenStripeAccountId(payout.stripeAccountId)}
                  </p>
                  <p>
                    <span className="font-semibold">User stripeAccountId:</span>{" "}
                    {shortenStripeAccountId(payout.user.stripeAccountId)}
                  </p>
                  <p>
                    <span className="font-semibold">questionId:</span>{" "}
                    {payout.questionId ?? "未設定"}
                  </p>
                  <p>
                    <span className="font-semibold">answerId:</span>{" "}
                    {payout.answerId ?? "未設定"}
                  </p>
                  <p>
                    <span className="font-semibold">negotiationId:</span>{" "}
                    {payout.negotiationId ?? "未設定"}
                  </p>
                </div>

                <div className="mt-3 grid gap-2 rounded bg-gray-50 p-3 text-sm text-gray-800 md:grid-cols-3">
                  <p>
                    <span className="font-semibold">報酬総額:</span>{" "}
                    {formatYen(grossAmount)}
                  </p>
                  <p>
                    <span className="font-semibold">手数料:</span>{" "}
                    {formatYen(platformFeeAmount)}
                  </p>
                  <p>
                    <span className="font-semibold">送金額:</span>{" "}
                    {formatYen(netAmount)}
                  </p>
                </div>

                {payout.question?.title && (
                  <p className="mt-2 text-sm text-gray-700">
                    <span className="font-semibold">質問:</span> {payout.question.title}
                  </p>
                )}

                {payout.failureReason && (
                  <p className="mt-2 text-sm text-red-700">
                    <span className="font-semibold">失敗理由:</span> {payout.failureReason}
                  </p>
                )}

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => handleTransfer(payout.id)}
                    disabled={!canTransfer || processingId === payout.id}
                    className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {processingId === payout.id ? "送金中..." : "送金する"}
                  </button>
                  {!canTransfer && payout.status !== "processing" && payout.status !== "paid" && (
                    <p className="mt-2 text-xs text-gray-500">
                      送金先 account または Connect 状態が未完了のため送金できません。
                    </p>
                  )}
                  {payout.status === "processing" && (
                    <p className="mt-2 text-xs text-gray-500">
                      現在この Payout は処理中です。
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
