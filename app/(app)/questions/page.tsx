// app/(app)/questions/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function highlight(text: string, keyword: string) {
  if (!keyword) return text;
  const regex = new RegExp(`(${keyword})`, "gi");
  return text.replace(regex, "<mark class='bg-yellow-200'>$1</mark>");
}

function extractPopularTags(questions: any[]) {
  const wordCount: Record<string, number> = {};
  const stopWords = [
    "です",
    "ます",
    "こと",
    "よう",
    "する",
    "ある",
    "いる",
    "これ",
    "それ",
    "あれ",
    "の",
    "に",
    "を",
    "が",
    "は",
  ];

  for (const q of questions) {
    const text = (q.title + " " + q.content)
      .replace(
        /[^\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}a-zA-Z0-9]/gu,
        " "
      )
      .toLowerCase();

    const words = text
      .split(/\s+/)
      .filter((w) => w.length > 1 && !stopWords.includes(w));

    for (const w of words) {
      wordCount[w] = (wordCount[w] || 0) + 1;
    }
  }

  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sort, setSort] = useState("new");
  const [popularTags, setPopularTags] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // 📌 URLパラメータを初期値として読み込む
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("q") || "");
    setSelectedCategory(params.get("category") || "");
    setSort(params.get("sort") || "new");

    const current = JSON.parse(localStorage.getItem("search-history") || "[]");
    setSearchHistory(current);
  }, []);

  // 📌 APIから質問・カテゴリーを取得
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/questions`);
        const data = await res.json();

        setQuestions(data.questions || []);
        setCategories(data.categories || []);
        setPopularTags(extractPopularTags(data.questions || []));
      } catch (err) {
        console.error("データ取得に失敗:", err);
      }
    }
    fetchData();
  }, []);

  // 📌 検索履歴
  const saveSearchHistory = (keyword: string) => {
    if (!keyword.trim()) return;
    const current = JSON.parse(localStorage.getItem("search-history") || "[]");
    const updated = [keyword, ...current.filter((item: string) => item !== keyword)].slice(
      0,
      5
    );
    localStorage.setItem("search-history", JSON.stringify(updated));
    setSearchHistory(updated);
  };

  const clearSearchHistory = () => {
    localStorage.removeItem("search-history");
    setSearchHistory([]);
  };

  // 📌 クライアント側でフィルタリング＆ソート
  const filteredQuestions = questions
    .filter((q) => (query ? q.title.includes(query) || q.content.includes(query) : true))
    .filter((q) => (selectedCategory ? q.category?.name === selectedCategory : true))
    .sort((a, b) => {
      if (sort === "new")
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === "reward") return b.rewardAmount - a.rewardAmount;
      if (sort === "answers") return (b.answers?.length ?? 0) - (a.answers?.length ?? 0);
      return 0;
    });

  // 📌 検索フォーム送信
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    saveSearchHistory(query);

    const params = new URLSearchParams();
    if (query) params.append("q", query);
    if (selectedCategory) params.append("category", selectedCategory);
    if (sort !== "new") params.append("sort", sort);

    window.location.href = `/questions?${params.toString()}`;
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">質問一覧</h1>

      {/* 🕘 最近の検索 */}
      {searchHistory.length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-bold mb-2 text-gray-600">🕘 最近の検索</h2>
          <div className="flex flex-wrap gap-2 items-center">
            {searchHistory.map((word) => (
              <a
                key={word}
                href={`/questions?q=${encodeURIComponent(word)}`}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded-full hover:bg-gray-200"
              >
                {word}
              </a>
            ))}
            <button
              onClick={clearSearchHistory}
              className="text-xs text-gray-500 underline hover:text-gray-700 ml-2"
            >
              履歴をクリア
            </button>
          </div>
        </div>
      )}

      {/* 📈 人気タグ */}
      {popularTags.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold mb-2 text-gray-600">📈 人気タグ</h2>
          <div className="flex flex-wrap gap-2">
            {popularTags.map((tag) => (
              <a
                key={tag}
                href={`/questions?q=${encodeURIComponent(tag)}`}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded-full hover:bg-gray-200"
              >
                #{tag}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 🔍 検索フォーム */}
      <form
        onSubmit={handleSubmit}
        className="mb-6 flex flex-col sm:flex-row gap-2 items-stretch sm:items-end"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="キーワードで検索..."
          className="flex-1 border rounded px-3 py-2"
        />

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">すべてのカテゴリー</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.name}>
              {cat.name}
            </option>
          ))}
        </select>

        <select value={sort} onChange={(e) => setSort(e.target.value)} className="border rounded px-3 py-2">
          <option value="new">新着順</option>
          <option value="reward">報酬額が高い順</option>
          <option value="answers">回答数が多い順</option>
        </select>

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          検索
        </button>

        <button
          type="button"
          onClick={() => {
            setQuery("");
            setSelectedCategory("");
            setSort("new");
            window.location.href = "/questions";
          }}
          className="text-gray-600 underline px-2 py-2 text-sm hover:text-gray-800"
        >
          クリア
        </button>
      </form>

      <div className="w-full flex justify-end mb-6">
        <a href="/questions/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
          質問を投稿する
        </a>
      </div>

      {/* 💬 質問一覧 */}
      <div className="space-y-4">
        {filteredQuestions.length === 0 && <p className="text-gray-500">質問がまだありません。</p>}

        {filteredQuestions.map((q) => (
          <Link
            key={q.id}
            href={`/questions/${q.id}`}
            className="block p-5 border rounded-lg shadow-sm hover:shadow-md transition bg-white"
          >
            <h2
              className="text-lg font-semibold text-gray-900"
              dangerouslySetInnerHTML={{ __html: highlight(q.title, query) }}
            />

            <span className="inline-block mt-2 px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded">
              {q.category?.name}
            </span>

            <p className="text-xs text-gray-500 mt-1">投稿日：{new Date(q.createdAt).toLocaleString()}</p>

            <p className="mt-2 text-sm text-gray-700 line-clamp-2">{q.content.slice(0, 100)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
