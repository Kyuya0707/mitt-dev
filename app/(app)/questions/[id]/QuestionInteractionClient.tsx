// app/questions/[id]/QuestionInteractionClient.tsx
"use client";

import { useState } from "react";
import AnswerCard from "./AnswerCard";
import AnswerForm from "./AnswerForm";
import type { QuestionAnswer } from "./types";

type QuoteMode = "short" | "full";

type QuestionInteractionClientProps = {
  questionId: string;
  consentAt: string | null;
  questionTitle: string;
  questionContent: string;
  answers: QuestionAnswer[];
  bestAnswerId: string | null;
  isAuthor: boolean;
  isLoggedIn: boolean;
  isClosed: boolean;
  fromNotification: boolean;
  markRead: (answerId: string) => Promise<boolean | null>;
  currentUserId: string | null;
};

export default function QuestionInteractionClient({
  questionId,
  consentAt,
  questionTitle,
  questionContent,
  answers,
  bestAnswerId,
  isAuthor,
  isLoggedIn,
  isClosed,
  fromNotification,
  markRead,
  currentUserId,
}: QuestionInteractionClientProps) {
  const [insertText, setInsertText] = useState<string | null>(null);
  const [quoteMode, setQuoteMode] = useState<QuoteMode>("short");

  const MAX_LINES = 5;

  const toQuote = (text: string) =>
    (text ?? "")
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");

  const buildQuoteFromAnswer = (answer: QuestionAnswer, mode: QuoteMode) => {
    const raw = (answer.content ?? "").trim();
    const lines = raw.split("\n");

    const clipped =
      mode === "full"
        ? lines
        : lines.slice(0, MAX_LINES).concat(lines.length > MAX_LINES ? ["…"] : []);

    const body = toQuote(clipped.join("\n"));

    const header =
      `> 【回答引用】${new Date(answer.createdAt).toLocaleString()}\n` +
      `> 引用元：[この回答へ移動](#answer-${answer.id})\n`;

    return `${header}${body}\n\n`;
  };

  const renderAnswerCard = (answer: QuestionAnswer) => {
    const isUnread = isLoggedIn && (answer.reads?.length ?? 0) === 0;

    return (
      <div
        key={answer.id}
        id={`answer-${answer.id}`}
        data-unread={isUnread ? "true" : "false"}
        className={
          fromNotification && isUnread
            ? "rounded border border-yellow-300 bg-yellow-50"
            : ""
        }
      >
        <AnswerCard
          ans={answer}
          isBest={answer.id === bestAnswerId}
          isAuthor={isAuthor}
          markRead={markRead}
          onQuote={() => setInsertText(buildQuoteFromAnswer(answer, quoteMode))}
          currentUserId={currentUserId}
        />
      </div>
    );
  };

  return (
    <>
      <div className="mt-10">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold">回答</h2>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">引用：</span>
            <button
              type="button"
              onClick={() => setQuoteMode("short")}
              className={`px-2 py-1 rounded border ${
                quoteMode === "short" ? "bg-gray-900 text-white" : "bg-white"
              }`}
            >
              要点（{MAX_LINES}行）
            </button>
            <button
              type="button"
              onClick={() => setQuoteMode("full")}
              className={`px-2 py-1 rounded border ${
                quoteMode === "full" ? "bg-gray-900 text-white" : "bg-white"
              }`}
            >
              全文
            </button>
          </div>
        </div>

        {answers.length === 0 ? (
          <p className="text-gray-500">まだ回答はありません。</p>
        ) : (
          <div className="space-y-8">{answers.map(renderAnswerCard)}</div>
        )}
      </div>

      {isLoggedIn && !isClosed && (
        <AnswerForm
          questionId={questionId}
          consentAt={consentAt}
          questionTitle={questionTitle}
          questionContent={questionContent}
          insertText={insertText}
          onInserted={() => setInsertText(null)}
        />
      )}
    </>
  );
}
