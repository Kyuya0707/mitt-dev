"use client";

import { useState } from "react";

export default function AccountDeletionSection() {
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm("退会すると元に戻せません。続けますか？")) return;
    setBusy(true);
    const response = await fetch("/api/account/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok && response.status !== 202) setMessage(data.error ?? "退会処理に失敗しました");
    else {
      setMessage(data.error ?? "退会処理が完了しました");
      window.location.href = "/";
    }
    setBusy(false);
  }

  return (
    <div className="border-t border-red-100 pt-4">
      <p className="text-sm font-semibold text-red-700">退会</p>
      <p className="mt-1 text-xs text-gray-600">投稿は購入者の閲覧権を守るため「退会済みユーザー」として匿名で保持されます。</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="退会する" className="rounded border p-2 text-sm" />
        <button disabled={busy || confirmation !== "退会する"} onClick={() => void remove()} className="rounded bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-40">退会を確定</button>
      </div>
      {message && <p className="mt-2 text-xs text-red-700">{message}</p>}
    </div>
  );
}
