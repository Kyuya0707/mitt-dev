"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MAX_ANSWER_DEADLINE_DAYS,
  MIN_ANSWER_DEADLINE_DAYS,
  formatJapaneseDateTime,
  getMinimumAnswerDeadline,
  toDatetimeLocalValue,
} from "@/lib/question-deadline";

type AnswerDeadlineEditorProps = {
  questionId: string;
  initialAnswerDeadline: string | null;
};

export default function AnswerDeadlineEditor({
  questionId,
  initialAnswerDeadline,
}: AnswerDeadlineEditorProps) {
  const router = useRouter();
  const [answerDeadline, setAnswerDeadline] = useState(
    initialAnswerDeadline ? toDatetimeLocalValue(initialAnswerDeadline) : ""
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAnswerDeadline(
      initialAnswerDeadline ? toDatetimeLocalValue(initialAnswerDeadline) : ""
    );
  }, [initialAnswerDeadline]);

  const currentLabel = useMemo(() => {
    return initialAnswerDeadline
      ? formatJapaneseDateTime(initialAnswerDeadline)
      : "回答期限なし";
  }, [initialAnswerDeadline]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    const rawValue = answerDeadline.trim();
    const now = new Date();
    const deadlineDate = rawValue ? new Date(rawValue) : null;

    if (!rawValue) {
      setError("回答期限を入力してください");
      setSaving(false);
      return;
    }

    if (rawValue) {
      if (Number.isNaN(deadlineDate?.getTime() ?? Number.NaN)) {
        setError("回答期限の形式が正しくありません");
        setSaving(false);
        return;
      }

      if ((deadlineDate?.getTime() ?? 0) <= now.getTime()) {
        setError("回答期限は現在時刻より後で設定してください");
        setSaving(false);
        return;
      }

      const currentDeadline = initialAnswerDeadline
        ? new Date(initialAnswerDeadline)
        : null;

      if (currentDeadline && currentDeadline.getTime() <= now.getTime()) {
        setError("回答期限を過ぎた質問は期限を変更できません");
        setSaving(false);
        return;
      }

      if (
        currentDeadline &&
        (deadlineDate?.getTime() ?? 0) <= currentDeadline.getTime()
      ) {
        setError("回答期限は現在の期限より後へ延長してください");
        setSaving(false);
        return;
      }

      if (
        !currentDeadline &&
        (deadlineDate?.getTime() ?? 0) < getMinimumAnswerDeadline(now).getTime()
      ) {
        setError(
          `回答期限は${MIN_ANSWER_DEADLINE_DAYS}日後以降で設定してください`
        );
        setSaving(false);
        return;
      }

      const maxDate = new Date(now);
      maxDate.setDate(maxDate.getDate() + MAX_ANSWER_DEADLINE_DAYS);
      if ((deadlineDate?.getTime() ?? 0) > maxDate.getTime()) {
        setError(
          `回答期限は${MAX_ANSWER_DEADLINE_DAYS}日以内で設定してください`
        );
        setSaving(false);
        return;
      }
    }

    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answerDeadline: rawValue,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        answerDeadline?: string | null;
      };

      if (!res.ok) {
        setError(data.error ?? "回答期限の更新に失敗しました");
        return;
      }

      setAnswerDeadline(data.answerDeadline ? toDatetimeLocalValue(data.answerDeadline) : "");
      setMessage("回答期限を更新しました");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="font-semibold text-gray-900">回答期限を変更</div>
      <p className="mt-1 text-xs leading-6 text-gray-500">
        期限前に限り、現在の期限より後へ延長できます。期限の短縮・削除はできません。
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="datetime-local"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black sm:max-w-sm"
          value={answerDeadline}
          onChange={(event) => setAnswerDeadline(event.target.value)}
          min={toDatetimeLocalValue(
            initialAnswerDeadline
              ? new Date(new Date(initialAnswerDeadline).getTime() + 60_000)
              : getMinimumAnswerDeadline()
          )}
          max={toDatetimeLocalValue(
            new Date(Date.now() + MAX_ANSWER_DEADLINE_DAYS * 24 * 60 * 60 * 1000)
          )}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "保存中..." : "変更する"}
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-500">現在の回答期限：{currentLabel}</p>
      {message && <p className="mt-2 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
