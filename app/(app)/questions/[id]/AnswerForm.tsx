// app/questions/[id]/AnswerForm.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ReactSortable } from "react-sortablejs";
import { agreeAction } from "@/app/mypage/agree-action";

export default function AnswerForm({
  questionId,
  consentAt,
  questionTitle,
  questionContent,
  insertText,
  onInserted,
}: {
  questionId: string;
  consentAt: string | null;
  questionTitle: string;
  questionContent: string;
  insertText?: string | null;
  onInserted?: () => void;
}) {
  const [content, setContent] = useState("");
  const [pitch, setPitch] = useState("");
  const [proposedAmount, setProposedAmount] = useState<number>(500);

  const [imageItems, setImageItems] = useState<
    { id: number; file: File; url: string }[]
  >([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ★ 同意チェックの状態（既に DB に consentAt があるなら true で開始）
  const [agree, setAgree] = useState(!!consentAt);

  const MAX_IMAGES = 5;

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
  const handleImageAdd = (e: any) => {
    const selected = Array.from(e.target.files) as File[];

    if (imageItems.length + selected.length > MAX_IMAGES) {
      setErrorMsg(`画像は最大 ${MAX_IMAGES} 枚までです`);
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
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    if (!agree) {
      setErrorMsg("注意事項に同意する必要があります。");
      setLoading(false);
      return;
    }

    // 交渉の最低限チェック
    if (!pitch.trim()) {
      setErrorMsg("交渉メッセージ（pitch）を入力してください");
      setLoading(false);
      return;
    }

    if (!Number.isFinite(proposedAmount) || proposedAmount < 100) {
      setErrorMsg("提案金額は100円以上で入力してください");
      setLoading(false);
      return;
    }

    // 本文は任意にしておく（後で「交渉形式のみ」に寄せられる）
    if (!content.trim()) {
      // content を必須にしたいならここをONに
      // setErrorMsg("回答内容を入力してください");
      // setLoading(false);
      // return;
    }

    const formData = new FormData();
    formData.append("content", content);
    formData.append("pitch", pitch);
    formData.append("proposedAmount", String(proposedAmount));
    formData.append("questionId", questionId);

    imageItems.forEach((item) => formData.append("images", item.file));

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

    window.location.reload();
  };

  return (
    <div className="p-6 mt-10 border rounded bg-gray-50 text-black">
      <h2 className="text-xl font-bold mb-4">回答する（交渉）</h2>

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
              onChange={async (e) => {
                const checked = e.target.checked;
                setAgree(checked);

                if (checked && !consentAt) {
                  await agreeAction(`/questions/${questionId}`);
                  setAgree(true);
                }
              }}
            />
            <span className="text-sm">上記に同意して回答する</span>
          </label>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ✅ 提案金額 */}
        <div>
          <label className="block text-sm font-medium mb-1">提案金額（円）</label>
          <input
            type="number"
            min={100}
            className="w-full border rounded p-2 text-gray-900"
            value={proposedAmount}
            onChange={(e) => setProposedAmount(Number(e.target.value))}
          />
          <p className="text-xs text-gray-500 mt-1">
            例：500円 / 1000円 など。質問者はこの金額で購入（解凍）できます。
          </p>
        </div>

        {/* ✅ 交渉メッセージ（pitch） */}
        <div>
          <label className="block text-sm font-medium mb-1">
            交渉メッセージ（pitch）
          </label>
          <textarea
            className="w-full border rounded p-2 h-24 text-gray-900"
            placeholder="例）このテーマは前提が重要なので、まず状況を3点だけ確認させてください。購入後、具体例とリスクも含めて整理します。"
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
          />
        </div>

        {/* ✅ 質問引用ボタン */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={insertQuestionQuote}
            className="text-sm px-3 py-1 rounded border bg-white hover:bg-gray-50"
          >
            質問を引用
          </button>
        </div>

        {/* 本文（任意） */}
        <div>
          <label className="block text-sm font-medium mb-1">本文（任意）</label>
          <textarea
            ref={textareaRef}
            className="w-full border rounded p-3 h-32 text-gray-900"
            placeholder="（任意）購入後に読ませたい本文を先に書いてもOK"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        {/* 画像 */}
        <input
          type="file"
          accept="image/*"
          multiple
          className="text-gray-900"
          onChange={handleImageAdd}
        />

        {imageItems.length > 0 && (
          <ReactSortable list={imageItems} setList={setImageItems}>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {imageItems.map((item) => (
                <div key={item.id} className="relative">
                  <img
                    src={item.url}
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

        {errorMsg && <p className="text-red-500">{errorMsg}</p>}

        <button
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded w-full disabled:opacity-60"
        >
          {loading ? "投稿中…" : "交渉として回答を投稿"}
        </button>
      </form>
    </div>
  );
}
