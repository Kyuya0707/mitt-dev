"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { toJapaneseErrorMessage } from "@/lib/errors";

type Supplement = {
  id: string;
  content: string;
  createdAt: string;
};

export default function QuestionSupplementSection({
  questionId,
  initialSupplements,
  isAuthor,
}: {
  questionId: string;
  initialSupplements: Supplement[];
  isAuthor: boolean;
}) {
  const [supplements, setSupplements] = useState(initialSupplements);
  const [content, setContent] = useState("");
  const [noAiConfirmed, setNoAiConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  const addSupplement = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/questions/${questionId}/supplements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, noAiConfirmed }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        supplement?: { id: string; content: string; createdAt: string };
      };
      if (!response.ok || !data.supplement) {
        alert(toJapaneseErrorMessage(data, "補足の追加に失敗しました"));
        return;
      }
      setSupplements((current) => [...current, data.supplement!]);
      setContent("");
      setNoAiConfirmed(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-6 space-y-3">
      {supplements.map((supplement) => (
        <div
          key={supplement.id}
          className="rounded-xl border border-blue-100 bg-blue-50 p-4"
        >
          <div className="text-xs font-semibold text-blue-800">
            質問者からの補足・{new Date(supplement.createdAt).toLocaleString("ja-JP")}
          </div>
          <div className="prose prose-sm mt-2 max-w-none text-gray-800">
            <ReactMarkdown>{supplement.content}</ReactMarkdown>
          </div>
        </div>
      ))}

      {isAuthor && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="font-semibold text-gray-900">質問へ補足を追記</div>
          <p className="mt-1 text-xs text-gray-500">
            元の質問本文は変更されません。回答済みユーザーへ通知します。
          </p>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={5000}
            rows={5}
            className="mt-3 w-full rounded border border-gray-300 bg-white p-3 text-sm text-gray-900"
          />
          <label className="mt-2 flex items-start gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={noAiConfirmed}
              onChange={(event) => setNoAiConfirmed(event.target.checked)}
              className="mt-0.5"
            />
            AIによる生成・要約・翻訳・校正・編集を使用していません
          </label>
          <button
            type="button"
            onClick={addSupplement}
            disabled={saving || !content.trim() || !noAiConfirmed}
            className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "追加中..." : "補足を追加"}
          </button>
        </div>
      )}
    </section>
  );
}
