// app/(app)/questions/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  formatJapaneseDateTime,
  getQuestionDeadlineState,
} from "@/lib/question-deadline";

type QuestionListItem = {
  id: string;
  title: string;
  content: string;
  createdAt: string | Date;
  rewardAmount: number;
  viewerPrice: number | null;
  answerDeadline: string | Date | null;
  isPaid: boolean;
  isClosed: boolean;
  bestAnswerId: string | null;
  category: {
    id: string;
    name: string;
  } | null;
  answerCount: number;
  boostCount: number;
  boostExpiresAt: string | null;
  isBoosted: boolean;
};

function highlight(text: string, keyword: string) {
  if (!keyword) return text;
  const regex = new RegExp(`(${keyword})`, "gi");
  return text.replace(regex, "<mark class='bg-yellow-200'>$1</mark>");
}

function extractPopularTags(questions: QuestionListItem[]) {
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

type QuestionsClientProps = {
  initialData: {
    items: QuestionListItem[];
    page: number;
    total: number;
    hasNextPage: boolean;
  };
  initialCategories: Array<{ id: string; name: string }>;
  initialFilters: {
    query: string;
    categoryId: string;
    sort: string;
    deadlineFilter: string;
    excludeBestSelected: boolean;
    minReward: string;
    maxReward: string;
  };
};

export default function QuestionsClient({
  initialData,
  initialCategories,
  initialFilters,
}: QuestionsClientProps) {
  const [questions, setQuestions] = useState<QuestionListItem[]>(initialData.items);
  const [categories] = useState(initialCategories);
  const [query, setQuery] = useState(initialFilters.query);
  const [selectedCategory, setSelectedCategory] = useState(
    initialFilters.categoryId
  );
  const [sort, setSort] = useState(initialFilters.sort);
  const [deadlineFilter, setDeadlineFilter] = useState(
    initialFilters.deadlineFilter
  );
  const [excludeBestSelected, setExcludeBestSelected] = useState(
    initialFilters.excludeBestSelected
  );
  const [minReward, setMinReward] = useState(initialFilters.minReward);
  const [maxReward, setMaxReward] = useState(initialFilters.maxReward);
  const [popularTags, setPopularTags] = useState<string[]>(
    extractPopularTags(initialData.items)
  );
  const [page, setPage] = useState(initialData.page);
  const [limit] = useState(20);
  const [total, setTotal] = useState(initialData.total);
  const [hasNextPage, setHasNextPage] = useState(initialData.hasNextPage);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const syncUrl = (paramsInput: {
    nextPage: number;
    nextQuery: string;
    nextCategoryId: string;
    nextSort: string;
    nextDeadlineFilter: string;
    nextExcludeBestSelected: boolean;
    nextMinReward: string;
    nextMaxReward: string;
  }) => {
    const params = new URLSearchParams();
    if (paramsInput.nextQuery) params.set("q", paramsInput.nextQuery);
    if (paramsInput.nextCategoryId) {
      params.set("categoryId", paramsInput.nextCategoryId);
    }
    if (paramsInput.nextSort !== "latest") params.set("sort", paramsInput.nextSort);
    if (paramsInput.nextDeadlineFilter !== "all") {
      params.set("deadlineFilter", paramsInput.nextDeadlineFilter);
    }
    if (paramsInput.nextExcludeBestSelected) params.set("excludeBest", "1");
    if (paramsInput.nextMinReward) params.set("minReward", paramsInput.nextMinReward);
    if (paramsInput.nextMaxReward) params.set("maxReward", paramsInput.nextMaxReward);
    if (paramsInput.nextPage > 1) params.set("page", String(paramsInput.nextPage));

    const nextUrl = params.toString()
      ? `/questions?${params.toString()}`
      : "/questions";

    window.history.replaceState({}, "", nextUrl);
  };

  const fetchQuestions = async ({
    nextPage = 1,
    append = false,
    nextQuery = query,
    nextCategoryId = selectedCategory,
    nextSort = sort,
    nextDeadlineFilter = deadlineFilter,
    nextExcludeBestSelected = excludeBestSelected,
    nextMinReward = minReward,
    nextMaxReward = maxReward,
  }: {
    nextPage?: number;
    append?: boolean;
    nextQuery?: string;
    nextCategoryId?: string;
    nextSort?: string;
    nextDeadlineFilter?: string;
    nextExcludeBestSelected?: boolean;
    nextMinReward?: string;
    nextMaxReward?: string;
  }) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setErrorMsg("");
    }

    try {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("limit", String(limit));

      if (nextQuery) params.set("q", nextQuery);
      if (nextCategoryId) params.set("categoryId", nextCategoryId);
      if (nextSort) params.set("sort", nextSort);
      if (nextDeadlineFilter !== "all") {
        params.set("deadlineFilter", nextDeadlineFilter);
      }
      if (nextExcludeBestSelected) params.set("excludeBest", "true");
      if (nextMinReward) params.set("minReward", nextMinReward);
      if (nextMaxReward) params.set("maxReward", nextMaxReward);

      const res = await fetch(`/api/questions?${params.toString()}`);
      const data = (await res.json()) as {
        items?: QuestionListItem[];
        total?: number;
        hasNextPage?: boolean;
        page?: number;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "質問一覧の取得に失敗しました");
      }

      const items = data.items || [];
      const mergedItems = append ? [...questions, ...items] : items;

      setQuestions(mergedItems);
      setPopularTags(extractPopularTags(mergedItems));
      const resolvedPage = data.page || nextPage;
      setTotal(data.total || 0);
      setHasNextPage(Boolean(data.hasNextPage));
      setPage(resolvedPage);
      syncUrl({
        nextPage: resolvedPage,
        nextQuery,
        nextCategoryId,
        nextSort,
        nextDeadlineFilter,
        nextExcludeBestSelected,
        nextMinReward,
        nextMaxReward,
      });
    } catch {
      setErrorMsg("質問一覧の取得に失敗しました。");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("search-history") || "[]");
      setSearchHistory(Array.isArray(saved) ? saved.slice(0, 5) : []);
    } catch {
      setSearchHistory([]);
    }
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

  // 📌 検索フォーム送信
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    saveSearchHistory(query);
    void fetchQuestions({
      nextPage: 1,
      nextQuery: query,
      nextCategoryId: selectedCategory,
      nextSort: sort,
      nextDeadlineFilter: deadlineFilter,
      nextExcludeBestSelected: excludeBestSelected,
      nextMinReward: minReward,
      nextMaxReward: maxReward,
    });
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
        className="mb-6 space-y-3"
      >
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="キーワードで検索..."
            className="w-full border rounded px-3 py-2 lg:min-w-[320px]"
          />

          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 lg:shrink-0"
          >
            検索
          </button>
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full border rounded px-3 py-2 lg:w-auto lg:min-w-[11rem] lg:flex-none"
          >
            <option value="">すべてのカテゴリー</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="w-full border rounded px-3 py-2 lg:w-auto lg:min-w-[10rem] lg:flex-none"
          >
            <option value="latest">新着順</option>
            <option value="reward">報酬額が高い順</option>
            <option value="answers">回答数が多い順</option>
            <option value="deadline_asc">期限が近い順</option>
          </select>

          <select
            value={deadlineFilter}
            onChange={(e) => setDeadlineFilter(e.target.value)}
            className="w-full border rounded px-3 py-2 lg:w-auto lg:min-w-[11rem] lg:flex-none"
          >
            <option value="all">回答期限すべて</option>
            <option value="has_deadline">回答期限あり</option>
            <option value="no_deadline">回答期限なし</option>
            <option value="open_deadline">回答期限内</option>
            <option value="expired_deadline">回答期限終了</option>
          </select>

          <input
            type="number"
            min={0}
            value={minReward}
            onChange={(e) => setMinReward(e.target.value)}
            placeholder="最低報酬"
            aria-label="最低報酬額"
            className="w-full rounded border px-3 py-2 lg:w-28"
          />
          <input
            type="number"
            min={0}
            value={maxReward}
            onChange={(e) => setMaxReward(e.target.value)}
            placeholder="最高報酬"
            aria-label="最高報酬額"
            className="w-full rounded border px-3 py-2 lg:w-28"
          />

          <label className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm text-gray-700 whitespace-nowrap lg:flex-none lg:shrink-0">
            <input
              type="checkbox"
              checked={excludeBestSelected}
              onChange={(e) => setExcludeBestSelected(e.target.checked)}
            />
            <span>BEST選定済みを除く</span>
          </label>

          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSelectedCategory("");
              setSort("latest");
              setDeadlineFilter("all");
              setExcludeBestSelected(false);
              setMinReward("");
              setMaxReward("");
              void fetchQuestions({
                nextPage: 1,
                nextQuery: "",
                nextCategoryId: "",
                nextSort: "latest",
                nextDeadlineFilter: "all",
                nextExcludeBestSelected: false,
                nextMinReward: "",
                nextMaxReward: "",
              });
            }}
            className="whitespace-nowrap px-2 py-2 text-sm text-gray-600 underline hover:text-gray-800 lg:flex-none lg:shrink-0"
          >
            クリア
          </button>
        </div>
      </form>

      <div className="w-full flex justify-end mb-6">
        <Link
          href="/questions/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          質問を投稿する
        </Link>
      </div>

      {/* 💬 質問一覧 */}
      <div className="space-y-4">
        {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>}
        {loading && <p className="text-gray-500">読み込み中...</p>}
        {!loading && questions.length === 0 && (
          <p className="text-gray-500">質問がまだありません。</p>
        )}

        {questions.map((q) => (
          <Link
            key={q.id}
            href={`/questions/${q.id}`}
            className={`block rounded-lg border p-5 shadow-sm transition hover:shadow-md ${
              q.isBoosted
                ? "border-orange-300 bg-orange-50 ring-2 ring-orange-100"
                : "bg-white"
            }`}
          >
            {q.isBoosted && (
              <span className="mb-2 inline-flex rounded-full bg-orange-600 px-3 py-1 text-xs font-bold text-white">
                🔥 Boost中
              </span>
            )}
            <h2
              className="text-lg font-semibold text-gray-900"
              dangerouslySetInnerHTML={{ __html: highlight(q.title, query) }}
            />

            <span className="inline-block mt-2 px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded">
              {q.category?.name}
            </span>
            {q.bestAnswerId && (
              <span className="inline-block mt-2 ml-2 rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">
                👑 BEST選定済み
              </span>
            )}
            {!q.isPaid && (
              <span className="inline-block mt-2 ml-2 px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded">
                🔒 未公開（決済待ち）
              </span>
            )}
            <span className="inline-block mt-2 ml-2 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
              {q.answerDeadline
                ? (() => {
                    const state = getQuestionDeadlineState({
                      answerDeadline: q.answerDeadline,
                    });
                    const label = formatJapaneseDateTime(q.answerDeadline);
                    return state === "expired"
                      ? `回答期限終了：${label}`
                      : `回答期限：${label}`;
                  })()
                : "回答期限なし"}
            </span>

            <p className="text-xs text-gray-500 mt-1">投稿日：{new Date(q.createdAt).toLocaleString()}</p>

            <p className="mt-2 text-sm text-gray-700 line-clamp-2">
              {q.isPaid
                ? q.content
                : "この質問は質問者の決済完了後に公開されます。"}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              回答数: {q.answerCount}件
            </p>
          </Link>
        ))}
      </div>

      {!loading && questions.length > 0 && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="text-sm text-gray-500">
            {questions.length} / {total} 件を表示中
          </p>
          {hasNextPage && (
            <button
              type="button"
              onClick={() => {
                void fetchQuestions({ nextPage: page + 1, append: true });
              }}
              disabled={loadingMore}
              className="rounded bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loadingMore ? "読み込み中..." : "もっと見る"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
