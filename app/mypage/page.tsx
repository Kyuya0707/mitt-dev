// app/mypage/page.tsx
import Link from "next/link";
import { PrismaClient } from "@prisma/client";
import { supabaseServer } from "@/lib/supabase-server";
import { agreeAction } from "./agree-action";

const prisma = new PrismaClient();

export default async function MyPage() {
  // ✅ Server 用 Supabase（cookies を読む）
  const supabase = await supabaseServer();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.warn("Supabase getUser error:", error.message);
  }

  if (!user) {
    return (
      <div className="p-6 text-center">
        <p className="mb-4">ログインが必要です。</p>
        <Link href="/login?redirectTo=/mypage" className="text-blue-600 underline">
          ログインページへ
        </Link>
      </div>
    );
  }

  // DB からユーザー＋履歴を取得
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      questions: {
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { category: true },
      },
      answers: {
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { question: true },
      },
    },
  });

  if (!dbUser) {
    return <div className="p-6">ユーザー情報が見つかりません。</div>;
  }

  const isAgreed = !!dbUser.consentAt;

  return (
    <div className="max-w-3xl mx-auto p-6 mt-10 text-black">
      <h1 className="text-3xl font-bold mb-8">マイページ</h1>

      <section className="p-5 bg-white border rounded shadow mb-10">
        <h2 className="text-xl font-semibold mb-3">基本情報</h2>
        <p>
          <span className="font-semibold">ユーザーID：</span> {dbUser.id}
        </p>
        <p>
          <span className="font-semibold">メール：</span> {dbUser.email}
        </p>
        <p className="mt-2">
          <span className="font-semibold">副業・税務の同意：</span>
          {isAgreed ? (
            <span className="text-green-600 font-bold">同意済み</span>
          ) : (
            <span className="text-red-600 font-bold">未同意</span>
          )}
        </p>
        {dbUser.consentAt && (
          <p className="text-sm text-gray-600 mt-1">
            同意日時：{new Date(dbUser.consentAt).toLocaleString("ja-JP")}
          </p>
        )}
      </section>

      {!isAgreed && (
        <section className="p-5 mb-10 bg-yellow-100 border border-yellow-400 rounded shadow">
          <h2 className="font-bold mb-2 text-lg">副業・税務に関する重要な確認</h2>

          <p className="text-sm mb-4 leading-relaxed">
            回答が選ばれると <strong>報酬が発生する</strong> 可能性があります。
            場合によっては副業扱いとなり、会社規定や
            <strong>確定申告などの税務対応</strong> が必要です。
          </p>

          <form
            action={async () => {
              "use server";
              await agreeAction("/mypage");
            }}
          >
            <button className="bg-blue-700 text-white px-4 py-2 rounded w-full hover:bg-blue-900 font-semibold">
              同意して利用を続ける
            </button>
          </form>
        </section>
      )}

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4 text-blue-700">
          質問投稿履歴（最新3件）
        </h2>

        {dbUser.questions.length === 0 ? (
          <p className="text-gray-500">まだ質問を投稿していません。</p>
        ) : (
          <div className="space-y-4">
            {dbUser.questions.map((q) => (
              <div key={q.id} className="p-4 bg-blue-50 border border-blue-200 rounded shadow">
                <Link href={`/questions/${q.id}`} className="font-semibold text-blue-800 underline">
                  {q.title}
                </Link>
                <p className="text-sm text-gray-600 mt-1">
                  投稿日時：{new Date(q.createdAt).toLocaleString("ja-JP")}
                </p>
                <p className="text-sm">カテゴリ：{q.category?.name}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <Link href="/mypage/questions" className="text-blue-600 underline text-sm hover:text-blue-800">
            → 質問履歴をすべて見る
          </Link>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4 text-green-700">
          回答履歴（最新3件）
        </h2>

        {dbUser.answers.length === 0 ? (
          <p className="text-gray-500">まだ回答していません。</p>
        ) : (
          <div className="space-y-4">
            {dbUser.answers.map((ans) => (
              <div key={ans.id} className="p-4 bg-green-50 border border-green-200 rounded shadow">
                <Link href={`/questions/${ans.questionId}`} className="font-semibold text-green-800 underline">
                  {ans.question?.title || "（削除された質問）"}
                </Link>

                <p className="text-sm text-gray-600 mt-1">
                  回答日時：{new Date(ans.createdAt).toLocaleString("ja-JP")}
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

        <div className="mt-4">
          <Link href="/mypage/answers" className="text-green-600 underline text-sm hover:text-green-800">
            → 回答履歴をすべて見る
          </Link>
        </div>
      </section>

      <div className="mt-6">
        <Link href="/mypage/purchases" className="text-blue-600 underline hover:text-blue-800">
          購入履歴（支払い履歴）を見る →
        </Link>
      </div>

      <Link href="/" className="text-blue-600 underline hover:text-blue-800 text-sm">
        ← トップへ戻る
      </Link>
    </div>
  );
}
