"use client";

import { useState } from "react";

type AnswerCardProps = {
  ans: { id: string; createdAt: string | Date; content: string };
  isBest: boolean;
  questionId?: string;
};

export default function AnswerCard({ ans, isBest }: AnswerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [likes, setLikes] = useState(
    Number(localStorage.getItem(`like-${ans.id}`) || 0)
  );

  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  const addLike = () => {
    const newLikes = likes + 1;
    setLikes(newLikes);
    localStorage.setItem(`like-${ans.id}`, String(newLikes));
  };

  return (
    <div className="relative">
      <div
        className={`p-5 rounded-xl border shadow-sm relative ${
          isBest
            ? "bg-yellow-50 border-yellow-400 best-answer-shine"
            : "bg-white border-gray-200"
        }`}
      >
        {/* 回答者情報 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-300" />
            <span className="text-sm text-gray-700">User123（仮）</span>
          </div>

          <span className="text-xs text-gray-500">
            {new Date(ans.createdAt).toLocaleString()}
          </span>
        </div>

        {/* 本文（続きを読む対応） */}
        <p
          className={`whitespace-pre-line text-gray-800 leading-relaxed ${
            expanded ? "" : "max-h-24 overflow-hidden"
          }`}
        >
          {ans.content}
        </p>

        {/* 続きを見る */}
        <button
          onClick={toggleExpand}
          className="mt-2 text-blue-600 text-sm underline"
        >
          {expanded ? "閉じる" : "続きを読む"}
        </button>

        {/* BEST バッジ */}
        {isBest && (
          <div className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-yellow-700">
            🏆 BEST回答
          </div>
        )}

        {/* 👍 いいね */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            className="text-sm text-gray-600 hover:text-gray-800"
            onClick={addLike}
          >
            👍 いいね
          </button>
          <span className="text-sm text-gray-700">{likes}</span>
        </div>
      </div>

      {/* ▼ 三角形 */}
      <div
        className={`h-0 w-0 border-transparent border-t-8 border-r-8 absolute left-6 -bottom-2 ${
          isBest ? "border-t-yellow-400" : "border-t-gray-200"
        }`}
      />
    </div>
  );
}
