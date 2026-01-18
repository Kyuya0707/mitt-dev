// app/questions/new/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientBrowser } from "@/lib/supabase-browser";
import { ReactSortable } from "react-sortablejs";

export default function NewQuestionPage() {
  const router = useRouter();
  const supabase = createClientBrowser();

  // ----------------------------
  // ① Hooks（順番はここで固定）
  // ----------------------------
  const [user, setUser] = useState<any | null>(undefined);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [rewardAmount, setRewardAmount] = useState(100);
  const [categories, setCategories] =
    useState<{ id: string; name: string }[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [imageItems, setImageItems] = useState<
    { id: number; file: File; url: string }[]
  >([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const MAX_IMAGES = 5;

  // ----------------------------
  // ② ログイン取得 & カテゴリ取得
  // ----------------------------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    fetch("/api/questions/categories")
      .then((res) => res.json())
      .then((data) => {
        setCategories(data);
        if (data.length > 0) setCategoryId(data[0].id);
      });
  }, []);

  // ----------------------------
  // ③ 画像ハンドラ
  // ----------------------------
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

  const deleteImage = (id: number) => {
    setImageItems(imageItems.filter((item) => item.id !== id));
  };

  // ----------------------------
  // ④ 投稿 → 支払いへ
  // ----------------------------
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      // --- FormData 準備 ---
      const formData = new FormData();
      formData.append("title", title);
      formData.append("body", body);
      formData.append("categoryId", categoryId);
      formData.append("rewardAmount", String(rewardAmount));
      imageItems.forEach((item) => formData.append("images", item.file));

      // ① まず質問をDBに保存
      const res = await fetch("/api/questions", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "投稿に失敗しました");
        setLoading(false);
        return;
      }

      const questionId = data.id as string | undefined;
      if (!questionId) {
        setErrorMsg("質問IDの取得に失敗しました");
        setLoading(false);
        return;
      }

      // ② ✅ 質問投稿支払い用 Checkout セッション作成（amountは送らない）
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

      alert(
        `決済の開始に失敗しました: ${checkoutData.error ?? "unknown error"}`
      );
      setLoading(false);
    } catch (err) {
      console.error(err);
      setErrorMsg("エラーが発生しました");
      setLoading(false);
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
          <a
            href="/login?redirectTo=/questions/new"
            className="underline text-blue-600"
          >
            ログインページへ
          </a>
        </div>
      )}

      {user && (
        <>
          <a
            href="/"
            className="inline-block mb-4 text-blue-600 underline hover:text-blue-800 text-sm"
          >
            ← 質問一覧に戻る
          </a>

          <h1 className="text-2xl font-bold mb-6">質問を投稿する</h1>

          {errorMsg && <p className="text-red-500 mb-2">{errorMsg}</p>}

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
              <label className="block mb-1 font-medium">報酬額（円）</label>
              <input
                type="number"
                className="w-full border p-2 rounded text-black"
                value={rewardAmount}
                onChange={(e) => setRewardAmount(Number(e.target.value))}
                min={100}
                required
              />
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
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "投稿中…" : "投稿して支払いに進む"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
