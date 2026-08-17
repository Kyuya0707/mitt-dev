"use client";

import { useEffect, useState } from "react";

type ReportRow = {
  id: string;
  createdAt: string;
  reason: string;
  details: string | null;
  status: string;
  questionId: string | null;
  answerId: string | null;
  commentId: string | null;
  resolutionNote: string | null;
  targetOwner: { id: string; username: string | null };
  sanction: { id: string; type: string; endsAt: string | null } | null;
};
type AppealRow = {
  id: string;
  createdAt: string;
  evidence: string;
  user: { id: string; username: string | null };
  sanction: { id: string; type: string; reason: string };
};

export default function AdminReportsTable() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [appeals, setAppeals] = useState<AppealRow[]>([]);
  const [appealNotes, setAppealNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const response = await fetch("/api/admin/reports", { cache: "no-store" });
    const data = (await response.json().catch(() => ({}))) as {
      reports?: ReportRow[];
      appeals?: AppealRow[];
    };
    setReports(data.reports ?? []);
    setAppeals(data.appeals ?? []);
    setLoading(false);
  };

  const reviewAppeal = async (appealId: string, action: "uphold" | "overturn") => {
    const response = await fetch(`/api/admin/appeals/${appealId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewNote: appealNotes[appealId] ?? "" }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setMessage(response.ok ? "異議申立ての審査結果を保存しました" : data.error || "保存に失敗しました");
    if (response.ok) await load();
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);

  const review = async (
    reportId: string,
    action: "confirm" | "dismiss",
    majorViolation = false
  ) => {
    const response = await fetch(`/api/admin/reports/${reportId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        majorViolation,
        resolutionNote: notes[reportId] ?? "",
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setMessage(response.ok ? "審査結果を保存しました" : data.error || "保存に失敗しました");
    if (response.ok) await load();
  };

  if (loading) return <p>読み込み中...</p>;

  return (
    <div className="space-y-4">
      {message && <p className="rounded bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
      {reports.length === 0 && <p className="text-sm text-gray-500">通報はありません。</p>}
      {reports.map((report) => {
        const targetUrl = report.questionId
          ? `/questions/${report.questionId}`
          : report.answerId
            ? `/questions?answerId=${report.answerId}`
            : null;
        return (
          <div key={report.id} className="rounded-xl border bg-white p-4">
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <p><strong>日時:</strong> {new Date(report.createdAt).toLocaleString("ja-JP")}</p>
              <p><strong>状態:</strong> {report.status}</p>
              <p><strong>理由:</strong> {report.reason}</p>
              <p><strong>対象者:</strong> {report.targetOwner.username || report.targetOwner.id}</p>
            </div>
            <p className="mt-3 whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm">{report.details}</p>
            {targetUrl && <a href={targetUrl} className="mt-2 inline-block text-sm text-blue-600 underline">対象を確認</a>}
            {report.status === "PENDING" ? (
              <div className="mt-4 space-y-3">
                <textarea
                  value={notes[report.id] ?? ""}
                  onChange={(event) =>
                    setNotes((current) => ({ ...current, [report.id]: event.target.value }))
                  }
                  rows={3}
                  placeholder="判断根拠・対象箇所を記録（5文字以上）"
                  className="w-full rounded border p-2 text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => review(report.id, "dismiss")} className="rounded border px-3 py-2 text-sm">問題なし</button>
                  <button onClick={() => review(report.id, "confirm")} className="rounded bg-orange-600 px-3 py-2 text-sm text-white">違反確認（段階制裁）</button>
                  <button onClick={() => review(report.id, "confirm", true)} className="rounded bg-red-800 px-3 py-2 text-sm text-white">重大違反（永久停止）</button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-600">{report.resolutionNote}</p>
            )}
          </div>
        );
      })}
      <h2 className="pt-6 text-xl font-bold">未審査の異議申立て</h2>
      {appeals.length === 0 && <p className="text-sm text-gray-500">未審査の異議申立てはありません。</p>}
      {appeals.map((appeal) => (
        <div key={appeal.id} className="rounded-xl border border-purple-200 bg-white p-4">
          <p className="text-sm"><strong>申立者:</strong> {appeal.user.username || appeal.user.id}</p>
          <p className="mt-1 text-sm"><strong>対象措置:</strong> {appeal.sanction.type} / {appeal.sanction.reason}</p>
          <p className="mt-3 whitespace-pre-wrap rounded bg-purple-50 p-3 text-sm">{appeal.evidence}</p>
          <textarea
            value={appealNotes[appeal.id] ?? ""}
            onChange={(event) => setAppealNotes((current) => ({ ...current, [appeal.id]: event.target.value }))}
            rows={3}
            placeholder="審査理由（5文字以上）"
            className="mt-3 w-full rounded border p-2 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <button onClick={() => reviewAppeal(appeal.id, "uphold")} className="rounded border px-3 py-2 text-sm">措置を維持</button>
            <button onClick={() => reviewAppeal(appeal.id, "overturn")} className="rounded bg-purple-700 px-3 py-2 text-sm text-white">措置を取消</button>
          </div>
        </div>
      ))}
    </div>
  );
}
