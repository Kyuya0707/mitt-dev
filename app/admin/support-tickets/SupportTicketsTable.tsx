"use client";

import { useEffect, useState } from "react";

type Ticket = {
  id: string; createdAt: string; category: string; subject: string; message: string;
  status: string; adminNote: string | null;
  requester: { username: string | null; email: string };
};

export default function SupportTicketsTable() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState("");
  async function load() {
    const response = await fetch("/api/admin/support-tickets", { cache: "no-store" });
    const data = (await response.json().catch(() => ({}))) as { tickets?: Ticket[]; error?: string };
    if (!response.ok) setError(data.error ?? "取得に失敗しました");
    else setTickets(data.tickets ?? []);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);

  async function update(id: string, status: string, adminNote: string) {
    const response = await fetch(`/api/admin/support-tickets/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, adminNote }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) setError(data.error ?? "更新に失敗しました");
    else await load();
  }

  return <div className="space-y-4">
    {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {tickets.length === 0 ? <p className="text-sm text-gray-500">お問い合わせはありません。</p> : tickets.map((ticket) => (
      <TicketRow key={ticket.id} ticket={ticket} onSave={update} />
    ))}
  </div>;
}

function TicketRow({ ticket, onSave }: { ticket: Ticket; onSave: (id: string, status: string, note: string) => Promise<void> }) {
  const [status, setStatus] = useState(ticket.status);
  const [note, setNote] = useState(ticket.adminNote ?? "");
  return <div className="rounded border bg-white p-4 text-sm">
    <p className="font-semibold">{ticket.subject}</p>
    <p className="mt-1 text-gray-500">{ticket.category} / {ticket.requester.username ?? ticket.requester.email} / {new Date(ticket.createdAt).toLocaleString("ja-JP")}</p>
    <p className="mt-3 whitespace-pre-wrap">{ticket.message}</p>
    <div className="mt-4 grid gap-2 sm:grid-cols-[180px_1fr_auto]">
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border p-2">
        <option value="OPEN">未対応</option><option value="IN_PROGRESS">対応中</option><option value="RESOLVED">解決</option><option value="CLOSED">終了</option>
      </select>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="運営メモ" className="rounded border p-2" />
      <button onClick={() => void onSave(ticket.id, status, note)} className="rounded bg-gray-900 px-4 py-2 text-white">保存</button>
    </div>
  </div>;
}
