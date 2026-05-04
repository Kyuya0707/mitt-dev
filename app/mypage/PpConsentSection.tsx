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

  const isAgreed = !!agreedAt;

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
    <>
      <p className="mt-2">
        <span className="font-semibold">副業・税務の同意：</span>
        {isAgreed ? (
          <span className="text-green-600 font-bold">同意済み</span>
        ) : (
          <span className="text-red-600 font-bold">未同意</span>
        )}
      </p>

      {agreedAt && (
        <p className="text-sm text-gray-600 mt-1">
          同意日時：{new Date(agreedAt).toLocaleString("ja-JP")}
        </p>
      )}

      {!isAgreed && (
        <section className="p-5 mt-5 bg-yellow-100 border border-yellow-400 rounded shadow">
          <h2 className="font-bold mb-2 text-lg">
            副業・税務に関する重要な確認
          </h2>

          <p className="text-sm mb-4 leading-relaxed">
            回答が選ばれると <strong>報酬が発生する</strong> 可能性があります。
            場合によっては副業扱いとなり、
            <strong>確定申告などの税務対応</strong> が必要です。
          </p>

          {errorMsg && <p className="mb-3 text-sm text-red-600">{errorMsg}</p>}

          <button
            type="button"
            onClick={handleAgree}
            disabled={saving}
            className="bg-blue-700 text-white px-4 py-2 rounded w-full hover:bg-blue-900 font-semibold disabled:opacity-60"
          >
            {saving ? "同意を保存中..." : "同意して利用を続ける"}
          </button>
        </section>
      )}
    </>
  );
}
