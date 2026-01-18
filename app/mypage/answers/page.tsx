// app/mypage/answers/page.tsx
import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import { createClientBrowser } from "@/lib/supabase-browser";
import Link from "next/link";

const prisma = new PrismaClient();

export default async function MyAnswersPage() {
  const supabase = createClientBrowser();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-6 text-center">
        <p className="mb-4">ログインが必要です。</p>
        <a
          href="/login?redirectTo=/mypage/answers"
          className="text-blue-600 underline"
        >
          ログインページへ
        </a>
      </div>
    );
  }

  const answers = await prisma.answer.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      question: true,
    },
  });

  return (
    <div className="max-w-3xl mx-auto p-6 mt-10 text-black">
      <h1 className="text-2xl font-bold mb-6">回答履歴</h1>

      {answers.length === 0 ? (
        <p className="text-gray-500">まだ回答していません。</p>
      ) : (
        <div className="space-y-4">
          {answers.map((ans) => (
            <div
              key={ans.id}
              className="p-5 bg-green-50 border border-green-200 rounded shadow"
            >
              <Link
                href={`/questions/${ans.questionId}`}
                className="font-semibold text-green-800 underline"
              >
                {ans.question?.title || "（削除された質問）"}
              </Link>

              <p className="text-sm mt-2 text-gray-600">
                回答日時：{new Date(ans.createdAt).toLocaleString("ja-JP")}
              </p>

              <p className="text-sm text-gray-700 mt-2">
                回答内容：{ans.content.slice(0, 60)}...
              </p>

              {ans.question?.bestAnswerId === ans.id ? (
                <p className="text-green-700 font-bold text-sm mt-1">
                  ★ BEST回答に選ばれました！
                </p>
              ) : (
                <p className="text-gray-600 text-sm mt-1">（通常回答）</p>
              )}
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
