"use client";

import Link from "next/link";
import { useState } from "react";

const categoryOptions = [
  ["PAYMENT", "決済"], ["REWARD", "報酬"], ["REPORT", "通報"],
  ["ACCOUNT", "アカウント"], ["OTHER", "その他"],
] as const;

export default function ContactPage() {
  const [category, setCategory] = useState("PAYMENT");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch("/api/support-tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, subject, message }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; ticketId?: string };
    setResult(response.ok ? `受け付けました（受付番号: ${data.ticketId}）` : data.error ?? "送信に失敗しました");
    if (response.ok) { setSubject(""); setMessage(""); }
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-2xl p-6 text-black">
      <h1 className="text-2xl font-bold">お問い合わせ</h1>
      <p className="mt-2 text-sm text-gray-600">ログイン後に送信できます。返信は登録メールアドレスへご案内します。</p>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border bg-white p-5">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded border p-2">
          {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={3} maxLength={100} placeholder="件名" className="w-full rounded border p-2" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} required minLength={10} maxLength={5000} rows={8} placeholder="お問い合わせ内容" className="w-full rounded border p-2" />
        <button disabled={busy} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">{busy ? "送信中..." : "送信する"}</button>
      </form>
      {result && <p className="mt-4 rounded bg-gray-50 p-3 text-sm">{result}</p>}
      <Link href="/mypage" className="mt-5 inline-block text-sm text-blue-600 underline">マイページへ戻る</Link>
    </main>
  );
}
