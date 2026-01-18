// app/mypage/questions/page.tsx
import { PrismaClient } from "@prisma/client";
import { createClientBrowser } from "@/lib/supabase-browser";
import Link from "next/link";

const prisma = new PrismaClient();

export default async function MyQuestionsPage() {
  const supabase = createClientBrowser();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-6 text-center">
        <p className="mb-4">ログインが必要です。</p>
        <a
          href="/login?redirectTo=/mypage/questions"
          className="text-blue-600 underline"
        >
          ログインページへ
        </a>
      </div>
    );
  }

  const questions = await prisma.question.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      category: true,
      answers: true,
    },
  });

  return (
    <div className="max-w-3xl mx-auto p-6 mt-10 text-black">
      <h1 className="text-2xl font-bold mb-6">質問履歴</h1>

      {questions.length === 0 ? (
        <p className="text-gray-500">まだ質問を投稿していません。</p>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <div
              key={q.id}
              className="p-5 bg-blue-50 border border-blue-200 rounded shadow"
            >
              <Link
                href={`/questions/${q.id}`}
                className="font-semibold text-blue-800 underline"
              >
                {q.title}
              </Link>

              {/* ステータス表示 */}
              <p className="mt-2 text-sm">
                {q.isPaid ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
                    支払い完了（公開中）
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold">
                    未決済（まだ公開されていません）
                  </span>
                )}
              </p>

              <p className="text-sm mt-2 text-gray-600">
                投稿日時：
                {new Date(q.createdAt).toLocaleString("ja-JP")}
              </p>

              <p className="text-sm">カテゴリ：{q.category?.name}</p>

              <p className="text-sm mt-1">
                回答数：{q.answers.length}件
                {q.bestAnswerId && (
                  <span className="ml-2 text-green-700 font-bold">
                    ★BEST回答あり
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <a href="/mypage" className="text-blue-600 underline">
          ← マイページに戻る
        </a>
      </div>
    </div>
  );
}
