"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Appeal = {
  id: string;
  createdAt: string;
  evidence: string;
  status: string;
  reviewNote: string | null;
};
type Sanction = {
  id: string;
  createdAt: string;
  type: string;
  reason: string;
  endsAt: string | null;
  revokedAt: string | null;
  appeals: Appeal[];
};

export default function AppealsPage() {
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  const load = async () => {
    const response = await fetch("/api/appeals", { cache: "no-store" });
    const data = (await response.json().catch(() => ({}))) as {
      sanctions?: Sanction[];
      error?: string;
    };
    if (!response.ok) {
      setMessage(data.error || "取得に失敗しました");
      return;
    }
    setSanctions(data.sanctions ?? []);
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);

  const submit = async (sanctionId: string) => {
    const response = await fetch("/api/appeals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sanctionId, evidence: evidence[sanctionId] ?? "" }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setMessage(response.ok ? "異議申立てを受け付けました" : data.error || "送信に失敗しました");
    if (response.ok) {
      setEvidence((current) => ({ ...current, [sanctionId]: "" }));
      await load();
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6 text-black">
      <h1 className="text-2xl font-bold">異議申立て</h1>
      <p className="mt-2 text-sm leading-7 text-gray-600">
        何度でも申立てできますが、前回から7日間の間隔と、新しい証拠または説明が必要です。
      </p>
      {message && <p className="mt-4 rounded bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
      <div className="mt-6 space-y-5">
        {sanctions.length === 0 && <p className="text-sm text-gray-500">対象の措置はありません。</p>}
        {sanctions.map((sanction) => (
          <div key={sanction.id} className="rounded-xl border bg-white p-4">
            <p className="font-semibold">措置: {sanction.type}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{sanction.reason}</p>
            <p className="mt-1 text-xs text-gray-500">
              {new Date(sanction.createdAt).toLocaleString("ja-JP")}
              {sanction.endsAt ? ` / 終了: ${new Date(sanction.endsAt).toLocaleString("ja-JP")}` : ""}
            </p>
            {sanction.revokedAt ? (
              <p className="mt-3 text-sm font-semibold text-green-700">この措置は取り消されています。</p>
            ) : (
              <div className="mt-4">
                <textarea
                  value={evidence[sanction.id] ?? ""}
                  onChange={(event) =>
                    setEvidence((current) => ({ ...current, [sanction.id]: event.target.value }))
                  }
                  rows={5}
                  maxLength={5000}
                  placeholder="前回と異なる新しい証拠・説明を30文字以上で入力"
                  className="w-full rounded border p-3 text-sm"
                />
                <button
                  type="button"
                  onClick={() => submit(sanction.id)}
                  disabled={(evidence[sanction.id]?.trim().length ?? 0) < 30}
                  className="mt-2 rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  異議申立てを送信
                </button>
              </div>
            )}
            {sanction.appeals.map((appeal) => (
              <div key={appeal.id} className="mt-3 rounded bg-gray-50 p-3 text-sm">
                <strong>{appeal.status}</strong>・{new Date(appeal.createdAt).toLocaleString("ja-JP")}
                <p className="mt-1 whitespace-pre-wrap text-gray-600">{appeal.evidence}</p>
                {appeal.reviewNote && <p className="mt-1 text-gray-700">運営回答: {appeal.reviewNote}</p>}
              </div>
            ))}
          </div>
        ))}
      </div>
      <Link href="/mypage" className="mt-6 inline-block text-blue-600 underline">← マイページへ戻る</Link>
    </div>
  );
}
