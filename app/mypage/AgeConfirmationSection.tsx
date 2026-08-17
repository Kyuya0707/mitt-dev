"use client";

import { useState } from "react";

export default function AgeConfirmationSection({
  ageConfirmedAt,
}: {
  ageConfirmedAt: string | null;
}) {
  const [confirmedAt, setConfirmedAt] = useState(ageConfirmedAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const confirmAge = async () => {
    if (!window.confirm("18歳以上であることを確認します。よろしいですか？")) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/user/age-confirmation", {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        ageConfirmedAt?: string;
      };

      if (!response.ok || !data.ageConfirmedAt) {
        setError(data.error || "年齢確認を保存できませんでした");
        return;
      }

      setConfirmedAt(data.ageConfirmedAt);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-gray-800">18歳以上の確認</span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            confirmedAt
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {confirmedAt ? "確認済み" : "未確認"}
        </span>
      </div>

      {confirmedAt ? (
        <p className="text-sm text-gray-600">
          確認日時: {new Date(confirmedAt).toLocaleString("ja-JP")}
        </p>
      ) : (
        <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4">
          <p className="text-sm leading-7 text-yellow-900">
            KnowValueは18歳以上の方のみ利用できます。質問・回答の投稿前に確認してください。
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={confirmAge}
            disabled={saving}
            className="mt-3 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "保存中..." : "18歳以上であることを確認する"}
          </button>
        </div>
      )}
    </div>
  );
}
