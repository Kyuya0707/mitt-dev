"use client";

import { useState } from "react";

const REASONS = [
  ["AI_CONTENT", "AI利用"],
  ["FINANCIAL_ADVICE", "禁止された金融助言"],
  ["FRAUD_FALSE", "詐欺・虚偽"],
  ["HARASSMENT", "誹謗中傷・迷惑行為"],
  ["COPYRIGHT", "著作権侵害"],
  ["OTHER", "その他"],
] as const;

export default function ReportButton({
  targetType,
  targetId,
}: {
  targetType: "question" | "answer" | "comment";
  targetId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>("AI_CONTENT");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async () => {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason, details }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage(data.error || "通報を送信できませんでした");
        return;
      }
      setMessage("運営への確認依頼を受け付けました。通報だけで自動処分は行いません。");
      setDetails("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 text-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-xs text-gray-500 underline"
      >
        この投稿を通報
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-lg border border-red-100 bg-red-50 p-3">
          <select
            value={reason}
            onChange={(event) =>
              setReason(event.target.value as (typeof REASONS)[number][0])
            }
            className="w-full rounded border border-gray-300 bg-white p-2 text-sm"
          >
            {REASONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="確認してほしい箇所と理由を具体的に入力してください"
            className="w-full rounded border border-gray-300 bg-white p-2 text-sm"
          />
          <button
            type="button"
            onClick={submit}
            disabled={saving || details.trim().length < 10}
            className="rounded bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? "送信中..." : "運営へ確認を依頼"}
          </button>
        </div>
      )}
      {message && <p className="mt-2 text-xs text-gray-600">{message}</p>}
    </div>
  );
}
