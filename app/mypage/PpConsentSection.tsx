"use client";

import { useEffect, useMemo, useState } from "react";

type PpConsentSectionProps = {
  ppConsentAt: string | null;
  redirectTo: string;
  onAgreed?: (ppConsentAt: string) => void;
  refreshOnSuccess?: boolean;
};

export default function PpConsentSection({
  ppConsentAt,
  redirectTo,
  onAgreed,
  refreshOnSuccess = true,
}: PpConsentSectionProps) {
  const [agreedAt, setAgreedAt] = useState(ppConsentAt);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const loginRedirectTo = useMemo(
    () => `/login?redirectTo=${encodeURIComponent(redirectTo)}`,
    [redirectTo]
  );

  useEffect(() => {
    setAgreedAt(ppConsentAt);
  }, [ppConsentAt]);

  const isAgreed = Boolean(agreedAt);

  const handleAgree = async () => {
    setSaving(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/user/pp-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redirectTo }),
      });

      const data = await res.json().catch(() => null);

      if (res.status === 401) {
        window.location.assign(loginRedirectTo);
        return;
      }

      if (!res.ok) {
        setErrorMsg(data?.error || "同意の保存に失敗しました");
        return;
      }

      const nextAgreedAt = data?.ppConsentAt ?? new Date().toISOString();
      setAgreedAt(nextAgreedAt);
      onAgreed?.(nextAgreedAt);

      if (refreshOnSuccess) {
        window.location.assign(redirectTo);
      }
    } catch (error) {
      console.error("[pp-consent][mypage] request error", error);
      setErrorMsg("同意の保存中にエラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-gray-800">副業・税務同意</span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            isAgreed
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {isAgreed ? "同意済み" : "未同意"}
        </span>
      </div>

      {agreedAt && (
        <p className="text-sm text-gray-600">
          同意日時: {new Date(agreedAt).toLocaleString("ja-JP")}
        </p>
      )}

      {!isAgreed && (
        <div className="rounded-2xl border border-yellow-300 bg-yellow-50 p-5">
          <h3 className="text-base font-semibold text-yellow-900">
            副業・税務に関する重要な確認
          </h3>
          <p className="mt-3 text-sm leading-7 text-yellow-900">
            回答が選ばれると <strong>報酬が発生する</strong> 可能性があります。
            場合によっては副業扱いとなり、
            <strong>確定申告などの税務対応</strong> が必要です。
          </p>

          {errorMsg && <p className="mt-3 text-sm text-red-600">{errorMsg}</p>}

          <button
            type="button"
            onClick={handleAgree}
            disabled={saving}
            className="mt-4 w-full rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-60"
          >
            {saving ? "同意を保存中..." : "同意して利用を続ける"}
          </button>
        </div>
      )}
    </div>
  );
}
