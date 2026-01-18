// app/mypage/purchases/page.tsx
import { PrismaClient } from "@prisma/client";
import { createClientBrowser } from "@/lib/supabase-browser";
import Link from "next/link";

const prisma = new PrismaClient();

export default async function PurchaseHistoryPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const supabase = createClientBrowser();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ログインしてない → ログインへ誘導
  if (!user) {
    return (
      <div className="p-6 text-center">
        <p>ログインが必要です。</p>
        <a
          href="/login?redirectTo=/mypage/purchases"
          className="text-blue-600 underline"
        >
          ログインページへ
        </a>
      </div>
    );
  }

  // ページ番号（デフォルト1）
  const page = Number(searchParams.page || 1);
  const take = 3; // 1ページ件数
  const skip = (page - 1) * take;

  // 購入履歴を取得
  const purchases = await prisma.purchase.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      question: true,
    },
    skip,
    take,
  });

  // 全件数（続きを表示するか判定）
  const totalCount = await prisma.purchase.count({
    where: { userId: user.id },
  });

  const hasNext = totalCount > page * take;

  return (
    <div className="max-w-3xl mx-auto p-6 mt-10 text-black">
      <h1 className="text-2xl font-bold mb-6">購入履歴（支払い履歴）</h1>

      {purchases.length === 0 ? (
        <p className="text-gray-500">購入履歴はまだありません。</p>
      ) : (
        <div className="space-y-4">
          {purchases.map((p) => (
            <div
              key={p.id}
              className="p-5 bg-white border border-purple-200 rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-200"
            >
              {/* タイトル行 */}
              <Link
                href={`/questions/${p.questionId}`}
                className="font-semibold text-purple-700 text-lg hover:underline flex items-center gap-2"
              >
                <span className="text-purple-500 text-2xl">🛒</span>
                {p.question?.title || "（削除された質問）"}
              </Link>

              {/* 情報行 */}
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                <div className="bg-purple-50 border border-purple-100 px-3 py-1 rounded-lg">
                  <span className="font-semibold">購入日時：</span>
                  {new Date(p.createdAt).toLocaleString("ja-JP")}
                </div>

                <div className="bg-purple-100 text-purple-900 font-bold px-3 py-1 rounded-full shadow-inner">
                  {p.amount.toLocaleString()} 円
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ▼ 続きを見る */}
      {hasNext && (
        <div className="mt-6 text-center">
          <Link
            href={`/mypage/purchases?page=${page + 1}`}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            続きを見る →
          </Link>
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
