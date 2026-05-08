"use client";

import { useState } from "react";
import MyPageCard from "./MyPageCard";

type StripeConnectSectionProps = {
  stripeAccountId: string | null;
  onboardingCompleted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  disabledReason: string | null;
  currentlyDueCount: number;
  connectStatusParam?: string | null;
};

function getStatusLabel(props: StripeConnectSectionProps) {
  if (!props.stripeAccountId) {
    return "未設定";
  }

  if (props.onboardingCompleted) {
    return "設定完了";
  }

  if (props.disabledReason || props.currentlyDueCount > 0) {
    return "要対応";
  }

  return "設定途中";
}

function getStatusDescription(props: StripeConnectSectionProps) {
  if (!props.stripeAccountId) {
    return "報酬を受け取るには、受取口座の登録が必要です。Stripe Connect で受取設定を開始してください。";
  }

  if (props.onboardingCompleted) {
    return "受取設定は完了しています。";
  }

  if (props.disabledReason || props.currentlyDueCount > 0) {
    return "追加の確認項目があります。BEST回答報酬やBEST閲覧料の分配を受け取るため、受取設定を続けてください。";
  }

  return "BEST回答報酬やBEST閲覧料の分配を受け取るため、Stripe 側の受取設定を完了してください。";
}

export default function StripeConnectSection(
  props: StripeConnectSectionProps
) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const statusLabel = getStatusLabel(props);
  const description = getStatusDescription(props);

  const handleOnboarding = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/stripe/connect/onboarding", {
        method: "POST",
      });

      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };

      if (!res.ok || !data.url) {
        setErrorMsg(data.error || "受取設定URLの作成に失敗しました。");
        return;
      }

      window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  };

  return (
    <MyPageCard
      title="報酬受取設定"
      description="報酬を受け取るには、受取口座の登録が必要です。BEST回答に選ばれた報酬やBEST閲覧料の分配を受け取るため、Stripe Connectで受取設定を行ってください。"
    >
      {props.connectStatusParam === "return" && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          受取設定の確認が完了しました。状態が反映されるまで少し時間がかかる場合があります。
        </div>
      )}

      {props.connectStatusParam === "refresh" && (
        <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          受取設定リンクの有効期限が切れました。もう一度お進みください。
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-800">ステータス</span>
        <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white">
          {statusLabel}
        </span>
      </div>
      <p className="mb-4 text-sm text-gray-600">{description}</p>

      {props.stripeAccountId && (
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            details_submitted: {props.detailsSubmitted ? "true" : "false"}
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            payouts_enabled: {props.payoutsEnabled ? "true" : "false"}
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            charges_enabled: {props.chargesEnabled ? "true" : "false"}
          </div>
        </div>
      )}

      {errorMsg && <p className="mb-3 text-sm text-red-600">{errorMsg}</p>}

      {props.onboardingCompleted ? (
        <p className="text-sm font-medium text-green-700">
          受取設定は完了しています。
        </p>
      ) : (
        <button
          type="button"
          onClick={handleOnboarding}
          disabled={loading}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading
            ? "Stripeへ移動中..."
            : props.stripeAccountId
              ? "受取設定を続ける"
              : "受取設定をする"}
        </button>
      )}
    </MyPageCard>
  );
}
