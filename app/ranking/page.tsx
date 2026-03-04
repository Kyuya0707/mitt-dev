// app/ranking/page.tsx
import Link from "next/link";

async function fetchRanking(range: "week" | "month" | "all") {
  const res = await fetch(
    `http://localhost:3000/api/ranking?range=${range}`,
    { cache: "no-store" }
  );

  return res.json();
}

export default async function RankingPage(props: {
  searchParams: Promise<{ range?: "week" | "month" | "all" }>;
}) {

  const searchParams = await props.searchParams;
  const range = searchParams?.range ?? "week";

  const data = await fetchRanking(range);

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

      {data.rows.length === 0 ? (
        <p>まだランキングデータがありません</p>
      ) : (
        <div className="space-y-3">
          {data.rows.map((r: any) => (
            <div key={r.rank} className="p-4 border rounded">
              <div className="font-bold">
                #{r.rank} {r.displayName}
              </div>

              <div className="text-sm">
                BEST回答数: {r.bestCount}
              </div>

              <div className="text-sm">
                信頼スコア: {r.trustScore}
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