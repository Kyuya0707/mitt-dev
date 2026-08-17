// app/questions/[id]/AnswerForm.tsx
"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ReactSortable } from "react-sortablejs";
import { trackGA4AnswerPosted } from "@/lib/ga";
import {
  ACCEPTED_UPLOAD_IMAGE_TYPES,
  MAX_UPLOAD_IMAGE_BYTES,
  MAX_UPLOAD_IMAGE_COUNT,
} from "@/lib/image-constraints";

export default function AnswerForm({
  questionId,
  ppConsentAt,
  questionTitle,
  questionContent,
  answerPagePath,
  insertText,
  onInserted,
}: {
  questionId: string;
  ppConsentAt: string | null;
  questionTitle: string;
  questionContent: string;
  answerPagePath: string;
  insertText?: string | null;
  onInserted?: () => void;
}) {
  const [content, setContent] = useState("");
  const [pitch, setPitch] = useState("");
  const [proposedAmount, setProposedAmount] = useState<string>("");
  const [isNegotiationOpen, setIsNegotiationOpen] = useState(false);

  const [imageItems, setImageItems] = useState<
    { id: number; file: File; url: string }[]
  >([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [noAiConfirmed, setNoAiConfirmed] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [agree, setAgree] = useState(!!ppConsentAt);

  const loginRedirectTo = `/login?redirectTo=${encodeURIComponent(answerPagePath)}`;

  useEffect(() => {
    setAgree(!!ppConsentAt);
  }, [ppConsentAt]);

  const toQuote = (text: string) => {
    const lines = (text ?? "").split("\n");
    return lines.map((l) => `> ${l}`).join("\n");
  };

  // ✅ 外部から「引用」を差し込む（AnswerCard → AnswerForm）
  useEffect(() => {
    if (!insertText) return;

    setContent((prev) => {
      const el = textareaRef.current;
      if (!el) return insertText + prev;

      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const next = prev.slice(0, start) + insertText + prev.slice(end);
      return next;
    });

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });

    onInserted?.();
  }, [insertText, onInserted]);

  const insertQuestionQuote = () => {
    const quoteBlock =
      `> 【質問】${questionTitle}\n` +
      `${toQuote(questionContent)}\n\n`;

    setContent((prev) => quoteBlock + prev);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const len = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(len, len);
    });
  };

  // ▼ 画像追加
  const handleImageAdd = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []) as File[];

    if (imageItems.length + selected.length > MAX_UPLOAD_IMAGE_COUNT) {
      setErrorMsg(`画像は最大${MAX_UPLOAD_IMAGE_COUNT}枚までです`);
      return;
    }

    const invalidFile = selected.find(
      (file) =>
        !(ACCEPTED_UPLOAD_IMAGE_TYPES as readonly string[]).includes(file.type) ||
        file.size > MAX_UPLOAD_IMAGE_BYTES
    );
    if (invalidFile) {
      setErrorMsg("画像は5MB以下のJPEG・PNG・WebPを選択してください");
      return;
    }

    const newItems = selected.map((file, index) => ({
      id: Date.now() + index,
      file,
      url: URL.createObjectURL(file),
    }));

    setImageItems([...imageItems, ...newItems]);
  };

  // ▼ 画像削除
  const deleteImage = (id: number) => {
    setImageItems(imageItems.filter((item) => item.id !== id));
  };

  // ▼ 回答送信
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    if (!agree) {
      setErrorMsg("注意事項に同意する必要があります。");
      setLoading(false);
      return;
    }

    const trimmedPitch = pitch.trim();
    const trimmedProposedAmount = proposedAmount.trim();
    const hasNegotiation = isNegotiationOpen;

    if (hasNegotiation) {
      if (!trimmedPitch) {
        setErrorMsg("交渉メッセージを入力してください");
        setLoading(false);
        return;
      }

      const parsedAmount = Number(trimmedProposedAmount);

      if (!Number.isFinite(parsedAmount) || parsedAmount < 100) {
        setErrorMsg("提案金額は100円以上で入力してください");
        setLoading(false);
        return;
      }
    } else if (!content.trim() && imageItems.length === 0) {
      setErrorMsg("回答本文または画像を入力してください");
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("content", hasNegotiation ? "" : content);
    formData.append("questionId", questionId);
    formData.append("noAiConfirmed", String(noAiConfirmed));

    if (hasNegotiation) {
      formData.append("pitch", trimmedPitch);
      formData.append("proposedAmount", trimmedProposedAmount);
    }

    if (!hasNegotiation) {
      imageItems.forEach((item) => formData.append("images", item.file));
    }

    const res = await fetch("/api/answers", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      setErrorMsg(err.error || "回答投稿に失敗しました");
      setLoading(false);
      return;
    }

    trackGA4AnswerPosted();
    window.location.reload();
  };

  const handleConsentChange = async (checked: boolean) => {
    if (!checked) {
      setAgree(false);
      return;
    }

    if (agree) return;

    setConsentSaving(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/user/pp-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redirectTo: answerPagePath }),
      });

      const data = await res.json().catch(() => null);

      if (res.status === 401) {
        window.location.href = loginRedirectTo;
        return;
      }

      if (!res.ok) {
        setErrorMsg(data?.error || "同意の保存に失敗しました");
        setAgree(false);
        return;
      }

      setAgree(true);
    } catch {
      setErrorMsg("同意の保存中にエラーが発生しました");
      setAgree(false);
    } finally {
      setConsentSaving(false);
    }
  };

  return (
    <div className="p-6 mt-10 border rounded bg-gray-50 text-black">
      <h2 className="text-xl font-bold mb-4">回答する</h2>

      {/* ▼ 未同意なら注意喚起ボックスを表示 */}
      {!agree && (
        <div className="mb-4 p-3 border border-yellow-400 bg-yellow-100 rounded">
          <p className="text-sm leading-relaxed mb-2">
            このサービスで収入を得る場合、<br />
            <strong>会社の副業規定</strong>や
            <strong>確定申告などの税務責任</strong>はご自身で対応する必要があります。
          </p>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={agree}
              disabled={consentSaving}
              onChange={(e) => handleConsentChange(e.target.checked)}
            />
            <span className="text-sm">
              {consentSaving ? "同意を保存中..." : "上記に同意して回答する"}
            </span>
          </label>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ✅ 質問引用ボタン */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={insertQuestionQuote}
            className="text-sm px-3 py-1 rounded border bg-white hover:bg-gray-50"
          >
            質問を引用
          </button>
          <button
            type="button"
            onClick={() => setIsNegotiationOpen((prev) => !prev)}
            className={`text-sm px-3 py-1 rounded border transition-colors ${
              isNegotiationOpen
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "bg-white hover:bg-gray-50"
            }`}
          >
            {isNegotiationOpen ? "交渉を閉じる" : "交渉する"}
          </button>
        </div>

        {isNegotiationOpen && (
          <div className="space-y-4 rounded-lg border border-blue-100 bg-white p-4">
            <div>
              <label className="block text-sm font-medium mb-1">追加報酬の提案額（円）</label>
              <input
                type="number"
                min={100}
                className="w-full border rounded p-2 text-gray-900"
                value={proposedAmount}
                onChange={(e) => setProposedAmount(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                承認時、質問者は提案額とその10%の利用料を支払います。回答投稿後、提案額の90%が追加報酬になります。
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                交渉メッセージ
              </label>
              <textarea
                className="w-full border rounded p-2 h-24 text-gray-900"
                placeholder="例）追加調査が必要なため、この条件で対応できます。購入後に具体例と注意点も整理してお渡しします。"
                value={pitch}
                onChange={(e) => setPitch(e.target.value)}
              />
            </div>
          </div>
        )}

        {!isNegotiationOpen && (
          <div>
            <label className="block text-sm font-medium mb-1">回答本文</label>
            <textarea
              ref={textareaRef}
              className="w-full border rounded p-3 h-32 text-gray-900"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
        )}

        {/* 画像 */}
        {!isNegotiationOpen && (
          <input
            type="file"
            accept={ACCEPTED_UPLOAD_IMAGE_TYPES.join(",")}
            multiple
            className="text-gray-900"
            onChange={handleImageAdd}
          />
        )}

        {imageItems.length > 0 && (
          <ReactSortable list={imageItems} setList={setImageItems}>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {imageItems.map((item) => (
                <div key={item.id} className="relative">
                  <img
                    src={item.url}
                    alt=""
                    className="w-full h-24 object-cover rounded border"
                  />
                  <button
                    type="button"
                    onClick={() => deleteImage(item.id)}
                    className="absolute top-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1 rounded"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </ReactSortable>
        )}

        <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={noAiConfirmed}
            onChange={(event) => setNoAiConfirmed(event.target.checked)}
            required
            className="mt-1"
          />
          <span>
            投稿内容にAIによる生成・要約・翻訳・校正・編集を使用していません。
          </span>
        </label>

        {errorMsg && <p className="text-red-500">{errorMsg}</p>}

        <button
          disabled={loading || !noAiConfirmed}
          className="bg-blue-600 text-white px-4 py-2 rounded w-full disabled:opacity-60"
        >
          {loading
            ? "送信中…"
            : isNegotiationOpen
              ? "追加報酬を提案"
              : "回答を投稿"}
        </button>
      </form>
    </div>
  );
}
