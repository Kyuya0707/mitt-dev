"use client";

import Link from "next/link";
import { useState } from "react";
import MyPageCard from "./MyPageCard";

type StripeConnectSectionProps = {
  stripeAccountId: string | null;
  onboardingCompleted: boolean;
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
    return "確認中";
  }

  return "確認中";
}

function getStatusDescription(props: StripeConnectSectionProps) {
  if (!props.stripeAccountId) {
    return "報酬を受け取るには設定が必要です。Stripeで本人確認・口座登録を行ってください。";
  }

  if (props.onboardingCompleted) {
    return "報酬受取設定が完了しています。";
  }

  if (props.disabledReason || props.currentlyDueCount > 0) {
    return "本人確認を確認中です。Stripe設定を完了してください。";
  }

  return "本人確認を確認中です。Stripe設定を完了してください。";
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
      description="報酬を受け取るには設定が必要です。Stripeで本人確認・口座登録を行ってください。"
    >
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
        Stripeでは、KnowValueの運営者ではなく、KnowValue上で回答や知識提供を行い報酬を受け取る利用者として登録してください。
        <div className="mt-2">
          <Link
            href="/stripe-connect-recipient"
            className="font-medium text-amber-950 underline underline-offset-2"
          >
            利用者向けの説明を見る
          </Link>
        </div>
      </div>

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

      {errorMsg && <p className="mb-3 text-sm text-red-600">{errorMsg}</p>}

      {props.onboardingCompleted ? (
        <p className="text-sm font-medium text-green-700">
          報酬受取設定が完了しています。
        </p>
      ) : (
        <button
          type="button"
          onClick={handleOnboarding}
          disabled={loading}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading
            ? "Stripe設定へ移動中..."
            : props.stripeAccountId
              ? "Stripe設定を続ける"
              : "Stripe設定をする"}
        </button>
      )}
    </MyPageCard>
  );
}
