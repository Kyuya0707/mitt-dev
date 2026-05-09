// app/questions/new/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClientBrowser } from "@/lib/supabase-browser";
import { ReactSortable } from "react-sortablejs";
import { getBestViewRevenueBreakdown } from "@/lib/best-view-breakdown";
import { MAX_VIEWER_PRICE_JPY } from "@/lib/viewer-price";
import { toJapaneseErrorMessage } from "@/lib/errors";
import { getQuestionRewardBreakdown } from "@/lib/reward-breakdown";
import type { User } from "@supabase/supabase-js";
import PpConsentSection from "@/app/mypage/PpConsentSection";

const REWARD_PRESETS = [500, 1000, 3000, 5000];

function formatYen(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return Math.max(0, Math.trunc(value)).toLocaleString("ja-JP");
}

export default function NewQuestionPage() {
  const supabase = createClientBrowser();

  // ----------------------------
  // ① Hooks（順番はここで固定）
  // ----------------------------
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [rewardAmount, setRewardAmount] = useState(500);
  const [viewerPrice, setViewerPrice] = useState(500);
  const [categories, setCategories] =
    useState<{ id: string; name: string }[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [imageItems, setImageItems] = useState<
    { id: number; file: File; url: string }[]
  >([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<
    "idle" | "saving" | "checkout"
  >("idle");
  const [ppConsentAt, setPpConsentAt] = useState<string | null>(null);
  const [consentLoading, setConsentLoading] = useState(false);

  const MAX_IMAGES = 5;

  // ----------------------------
  // ② ログイン取得 & カテゴリ取得
  // ----------------------------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    fetch("/api/questions/categories", { cache: "force-cache" })
      .then((res) => res.json())
      .then((data) => {
        setCategories(data);
        if (data.length > 0) setCategoryId(data[0].id);
      });
  }, [supabase]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    const loadConsentStatus = async () => {
      setConsentLoading(true);

      try {
        const res = await fetch("/api/user/pp-consent", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as {
          ppConsentAt?: string | null;
          consentAt?: string | null;
        };

        if (!res.ok) {
          throw data;
        }

        if (!cancelled) {
          setPpConsentAt(data.ppConsentAt ?? data.consentAt ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMsg(
            toJapaneseErrorMessage(error, "同意状態の取得に失敗しました")
          );
        }
      } finally {
        if (!cancelled) {
          setConsentLoading(false);
        }
      }
    };

    void loadConsentStatus();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const canSubmitQuestion = Boolean(ppConsentAt);
  const rewardBreakdown = getQuestionRewardBreakdown(rewardAmount);
  const bestViewBreakdown = getBestViewRevenueBreakdown(viewerPrice);

  const handleRewardAmountChange = (value: string) => {
    setRewardAmount(value === "" ? 0 : Number(value));
  };

  const handleViewerPriceChange = (value: string) => {
    setViewerPrice(value === "" ? 0 : Number(value));
  };

  // ----------------------------
  // ③ 画像ハンドラ
  // ----------------------------
  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);

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

  const deleteImage = (id: number) => {
    setImageItems(imageItems.filter((item) => item.id !== id));
  };

  // ----------------------------
  // ④ 投稿 → 支払いへ
  // ----------------------------
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");

    if (!canSubmitQuestion) {
      setErrorMsg(
        "質問を投稿するには、副業・税務に関する同意が必要です。"
      );
      return;
    }

    setLoading(true);
    setSubmitPhase("saving");

    try {
      // --- FormData 準備 ---
      const formData = new FormData();
      formData.append("title", title);
      formData.append("body", body);
      formData.append("categoryId", categoryId);
      formData.append("rewardAmount", String(rewardAmount));
      formData.append("viewerPrice", String(viewerPrice));
      imageItems.forEach((item) => formData.append("images", item.file));

      // ① まず質問をDBに保存
      const res = await fetch("/api/questions", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(toJapaneseErrorMessage(data, "投稿に失敗しました"));
        setLoading(false);
        setSubmitPhase("idle");
        return;
      }

      const questionId = data.id as string | undefined;
      if (!questionId) {
        setErrorMsg("質問IDの取得に失敗しました");
        setLoading(false);
        setSubmitPhase("idle");
        return;
      }

      // ② ✅ 質問投稿支払い用 Checkout セッション作成（amountは送らない）
      setSubmitPhase("checkout");
      const checkoutRes = await fetch("/api/checkout/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });

      const checkoutData = await checkoutRes.json();

      if (checkoutRes.ok && checkoutData.url) {
        // ③ Stripe へ遷移
        window.location.href = checkoutData.url;
        return;
      }

      alert(toJapaneseErrorMessage(checkoutData, "決済の開始に失敗しました"));
      setLoading(false);
      setSubmitPhase("idle");
    } catch (err) {
      console.error(err);
      setErrorMsg(toJapaneseErrorMessage(err, "エラーが発生しました"));
      setLoading(false);
      setSubmitPhase("idle");
    }
  };

  // ----------------------------
  // ⑤ JSX
  // ----------------------------
  return (
    <div className="max-w-xl mx-auto p-6 mt-10 bg-white shadow rounded text-black">
      {user === undefined && (
        <div className="p-10 text-center text-gray-500">読み込み中...</div>
      )}

      {user === null && (
        <div className="text-center p-10 text-red-500">
          質問投稿にはログインが必要です。
          <br />
          <Link
            href="/login?redirectTo=/questions/new"
            className="underline text-blue-600"
          >
            ログインページへ
          </Link>
        </div>
      )}

      {user && (
        <>
          <Link
            href="/questions"
            className="inline-block mb-4 text-blue-600 underline hover:text-blue-800 text-sm"
          >
            ← 質問一覧に戻る
          </Link>

          <h1 className="text-2xl font-bold mb-6">質問を投稿する</h1>

          {errorMsg && <p className="text-red-500 mb-2">{errorMsg}</p>}

          <div className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
            <h2 className="text-lg font-bold text-yellow-950">
              良い質問ほど、良い回答が集まります
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-yellow-900">
              <li>・ どんな背景や状況なのかを書く</li>
              <li>・ 何に悩んでいるのかを具体的に書く</li>
              <li>・ 比較した内容や試したことを書く</li>
              <li>・ 実際に知りたいことをはっきり書く</li>
            </ul>
            <p className="mt-3 text-sm text-yellow-800">
              実体験ベースの回答が届きやすくなります。
            </p>
          </div>

          {consentLoading ? (
            <div className="mb-6 rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              同意状態を確認しています...
            </div>
          ) : !canSubmitQuestion ? (
            <div className="mb-6 rounded border border-yellow-300 bg-yellow-50 p-4">
              <p className="mb-3 text-sm text-yellow-900">
                質問を投稿するには、副業・税務に関する同意が必要です。
              </p>
              <PpConsentSection
                ppConsentAt={ppConsentAt}
                redirectTo="/questions/new"
                refreshOnSuccess={false}
                onAgreed={(agreedAt) => {
                  setPpConsentAt(agreedAt);
                  setErrorMsg("");
                }}
              />
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* タイトル */}
            <div>
              <label className="block mb-1 font-medium">タイトル</label>
              <input
                className="w-full border p-2 rounded text-black"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* カテゴリ */}
            <div>
              <label className="block mb-1 font-medium">カテゴリー</label>
              <select
                className="w-full border p-2 rounded text-black"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 本文 */}
            <div>
              <label className="block mb-1 font-medium">本文</label>
              <textarea
                className="w-full border p-2 rounded text-black"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>

            {/* 報酬額 */}
            <div>
              <label className="block mb-1 font-medium">回答者への報酬額</label>
              <div className="flex items-center overflow-hidden rounded border">
                <input
                  type="number"
                  className="w-full p-2 text-black outline-none"
                  value={rewardAmount}
                  onChange={(e) => handleRewardAmountChange(e.target.value)}
                  min={500}
                  step={100}
                  required
                />
                <span className="border-l bg-gray-50 px-4 py-2 text-sm text-gray-700">
                  円
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                BEST回答に選ばれた回答者へ支払われる報酬です。最低報酬額は500円です。現在:{" "}
                {formatYen(rewardAmount)}円
              </p>
              <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-gray-700">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-white px-3 py-2">
                    <div className="text-xs text-gray-500">回答者へ支払う報酬</div>
                    <div className="font-semibold text-gray-900">
                      {formatYen(rewardBreakdown.grossAmount)}円
                    </div>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2">
                    <div className="text-xs text-gray-500">プラットフォーム手数料</div>
                    <div className="font-semibold text-gray-900">
                      {formatYen(rewardBreakdown.platformFeeAmount)}円
                    </div>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2">
                    <div className="text-xs text-gray-500">決済額</div>
                    <div className="font-semibold text-gray-900">
                      {formatYen(rewardBreakdown.checkoutAmount)}円
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-6 text-gray-600">
                  回答してもらうための報酬を設定します。実際の決済時には、この報酬額にプラットフォーム手数料10%を加算した金額を決済します。
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {REWARD_PRESETS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setRewardAmount(amount)}
                    className={`rounded-full border px-3 py-1 text-sm transition ${
                      rewardAmount === amount
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {amount.toLocaleString("ja-JP")}円
                  </button>
                ))}
              </div>
            </div>

            {/* BEST閲覧価格 */}
            <div>
              <label className="block mb-1 font-medium">BEST閲覧価格</label>
              <div className="flex items-center overflow-hidden rounded border">
                <input
                  type="number"
                  className="w-full p-2 text-black outline-none"
                  value={viewerPrice}
                  onChange={(e) => handleViewerPriceChange(e.target.value)}
                  onInvalid={(e) => {
                    e.currentTarget.setCustomValidity(
                      "BEST閲覧価格は1円以上100,000円以下の整数で入力してください"
                    );
                  }}
                  onInput={(e) => {
                    e.currentTarget.setCustomValidity("");
                  }}
                  min={1}
                  max={MAX_VIEWER_PRICE_JPY}
                  step={1}
                  required
                />
                <span className="border-l bg-gray-50 px-4 py-2 text-sm text-gray-700">
                  円
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                BEST回答の閲覧時に購入者へ請求する金額です（1円〜
                {MAX_VIEWER_PRICE_JPY.toLocaleString("ja-JP")}円、1円単位）
              </p>
              <p className="mt-1 text-xs text-gray-500">
                現在: {formatYen(viewerPrice)}円
              </p>
              {viewerPrice > 0 && (
                <div className="mt-3 rounded-xl border border-yellow-100 bg-yellow-50 p-4 text-sm text-gray-700">
                  <p className="mb-3 text-gray-700">
                    BEST回答は有料公開できます。閲覧料金は質問者・回答者へ分配されます。
                  </p>
                  <div className="font-semibold text-gray-900">BEST閲覧料の分配</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg bg-white px-3 py-2">
                      <div className="text-xs text-gray-500">質問者への報酬</div>
                      <div className="font-semibold text-gray-900">
                        {formatYen(bestViewBreakdown.questionOwnerAmount)}円
                      </div>
                    </div>
                    <div className="rounded-lg bg-white px-3 py-2">
                      <div className="text-xs text-gray-500">回答者への報酬</div>
                      <div className="font-semibold text-gray-900">
                        {formatYen(bestViewBreakdown.answerOwnerAmount)}円
                      </div>
                    </div>
                    <div className="rounded-lg bg-white px-3 py-2">
                      <div className="text-xs text-gray-500">
                        プラットフォーム手数料
                      </div>
                      <div className="font-semibold text-gray-900">
                        {formatYen(bestViewBreakdown.platformFeeAmount)}円
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 画像 */}
            <div>
              <label className="block mb-1 font-medium">画像（最大5枚）</label>

              <label className="bg-blue-600 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-700 inline-block">
                画像を選択
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageAdd}
                />
              </label>

              {/* サムネ */}
              {imageItems.length > 0 && (
                <ReactSortable list={imageItems} setList={setImageItems}>
                  {imageItems.map((item) => (
                    <div
                      key={item.id}
                      className="relative inline-block mr-2 mt-2"
                    >
                      <img
                        src={item.url}
                        className="w-24 h-24 object-cover rounded border"
                        alt="質問画像プレビュー"
                      />
                      <button
                        type="button"
                        onClick={() => deleteImage(item.id)}
                        className="absolute top-0 right-0 bg-black bg-opacity-60 text-white text-xs px-1 rounded"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </ReactSortable>
              )}
            </div>

            <button
              disabled={loading || consentLoading || !canSubmitQuestion}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? submitPhase === "checkout"
                  ? "決済ページを準備中..."
                  : "画像と投稿内容を保存中..."
                : !canSubmitQuestion
                  ? "同意後に投稿できます"
                  : "投稿して支払いに進む"}
            </button>
            {loading && (
              <p className="text-xs leading-6 text-gray-500">
                {submitPhase === "checkout"
                  ? "投稿内容の保存が完了しました。決済ページへ移動します。"
                  : "質問内容と添付画像を保存しています。画像が多い場合は少し時間がかかることがあります。"}
              </p>
            )}
            <p className="text-xs leading-6 text-gray-500">
              決済に進むことで、
              <Link href="/terms" className="mx-1 text-blue-600 underline">
                利用規約
              </Link>
              および
              <Link href="/refund-policy" className="mx-1 text-blue-600 underline">
                返金ポリシー
              </Link>
              に同意したものとみなします。
            </p>
          </form>
        </>
      )}
    </div>
  );
}
