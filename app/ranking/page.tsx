// app/ranking/page.tsx
import Link from "next/link";
import {
  getRankingRows,
  normalizeRankingRange,
  type RankingRow,
} from "@/lib/ranking";

export const dynamic = "force-dynamic";

export default async function RankingPage(props: {
  searchParams: Promise<{ range?: "week" | "month" | "all" }>;
}) {

  const searchParams = await props.searchParams;
  const range = normalizeRankingRange(searchParams?.range);
  const rows = await getRankingRows(range);

  const title =
    range === "week" ? "週間" :
    range === "month" ? "月間" :
    "累計";

  return (
    <div className="max-w-3xl mx-auto p-6 mt-10 text-black">
      <h1 className="text-3xl font-bold mb-2">回答者ランキング</h1>

      <p className="text-gray-600 mb-6">
        BEST回答数ランキング（{title}）
      </p>

      <div className="flex gap-3 mb-6">
        <Link href="/ranking?range=week">週間</Link>
        <Link href="/ranking?range=month">月間</Link>
        <Link href="/ranking?range=all">累計</Link>
      </div>

      {rows.length === 0 ? (
        <p>まだランキングデータがありません</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r: RankingRow) => (
            <div key={r.userId} className="p-4 border rounded">
              <div className="font-bold">
                #{r.rank} {r.displayName}
              </div>

              <div className="text-sm">
                BEST回答数: {r.bestCount}
              </div>

              <div className="text-sm">
                信頼スコア: {r.trustScore}
              </div>

              <div className="text-sm">
                ランク: {r.trustRank}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Link href="/">←トップへ戻る</Link>
      </div>
    </div>
  );
}
