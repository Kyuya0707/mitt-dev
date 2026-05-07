import Link from "next/link";
import AppHeader from "@/app/components/AppHeader";
import prisma from "@/lib/prisma";
import { getCurrentUserAdminStatus } from "@/lib/admin";
import AdminNav from "./AdminNav";

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-gray-900">{value}</div>
      {description && (
        <div className="mt-2 text-xs leading-6 text-gray-500">{description}</div>
      )}
    </div>
  );
}

function formatYen(value: number) {
  return `${value.toLocaleString("ja-JP")}円`;
}

export default async function AdminDashboardPage() {
  const { user, isAdmin } = await getCurrentUserAdminStatus();

  if (!user) {
    return (
      <div className="min-h-screen bg-white text-black">
        <AppHeader />
        <main className="px-6 py-6">
          <div className="mx-auto max-w-6xl">
            <p className="text-sm text-gray-700">ログインしてください。</p>
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white text-black">
        <AppHeader />
        <main className="px-6 py-6">
          <div className="mx-auto max-w-6xl">
            <p className="text-sm text-red-700">管理者のみ閲覧できます。</p>
          </div>
        </main>
      </div>
    );
  }

  const [
    userCount,
    questionCount,
    answerCount,
    bestSelectedQuestionCount,
    unpaidQuestionCount,
    paidQuestionCount,
    bestViewPurchaseCount,
    questionPostGrossSales,
    bestViewGrossSales,
    pendingPayoutCount,
    paidPayoutCount,
    pendingBestViewPayoutCount,
    paidBestViewPayoutCount,
    recentQuestions,
    recentAnswers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.question.count(),
    prisma.answer.count(),
    prisma.question.count({ where: { bestAnswerId: { not: null } } }),
    prisma.question.count({ where: { bestAnswerId: null } }),
    prisma.question.count({ where: { isPaid: true } }),
    prisma.purchase.count({
      where: {
        bestViewRevenueShare: { isNot: null },
      },
    }),
    prisma.purchase.aggregate({
      where: {
        question: { is: { userId: { not: null } } },
        bestViewRevenueShare: null,
        status: "PAID",
      },
      _sum: { amount: true },
    }),
    prisma.purchase.aggregate({
      where: {
        bestViewRevenueShare: { isNot: null },
        status: "PAID",
      },
      _sum: { amount: true },
    }),
    prisma.payout.count({
      where: { status: { in: ["pending", "failed", "processing"] } },
    }),
    prisma.payout.count({
      where: { status: "paid" },
    }),
    prisma.bestViewPayout.count({
      where: { status: { in: ["pending", "failed", "processing"] } },
    }),
    prisma.bestViewPayout.count({
      where: { status: "paid" },
    }),
    prisma.question.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        createdAt: true,
        rewardAmount: true,
        bestAnswerId: true,
        isPaid: true,
      },
    }),
    prisma.answer.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        questionId: true,
        createdAt: true,
        content: true,
        user: {
          select: {
            username: true,
          },
        },
      },
    }),
  ]);

  const adminActionCount = pendingPayoutCount + pendingBestViewPayoutCount;

  return (
    <div className="min-h-screen bg-gray-50 text-black">
      <AppHeader />
      <main className="px-6 py-6">
        <div className="mx-auto max-w-6xl">
          <AdminNav current="dashboard" />
          <div className="mb-8">
            <h1 className="text-3xl font-bold">管理ダッシュボード</h1>
            <p className="mt-2 text-sm text-gray-600">
              Know Value 全体の状況を簡易的に確認できます。
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="登録ユーザー数" value={String(userCount)} />
            <SummaryCard label="質問数" value={String(questionCount)} />
            <SummaryCard label="回答数" value={String(answerCount)} />
            <SummaryCard
              label="BEST選定済み質問数"
              value={String(bestSelectedQuestionCount)}
            />
            <SummaryCard label="未選定質問数" value={String(unpaidQuestionCount)} />
            <SummaryCard label="有料質問数" value={String(paidQuestionCount)} />
            <SummaryCard
              label="BEST閲覧購入数"
              value={String(bestViewPurchaseCount)}
            />
            <SummaryCard
              label="管理者対応件数"
              value={String(adminActionCount)}
              description="未送金または失敗状態の Payout 件数です。"
            />
            <SummaryCard
              label="質問投稿決済売上"
              value={formatYen(questionPostGrossSales._sum.amount ?? 0)}
            />
            <SummaryCard
              label="BEST閲覧売上"
              value={formatYen(bestViewGrossSales._sum.amount ?? 0)}
            />
            <SummaryCard
              label="質問報酬 未送金件数"
              value={String(pendingPayoutCount)}
            />
            <SummaryCard
              label="質問報酬 送金済み件数"
              value={String(paidPayoutCount)}
            />
            <SummaryCard
              label="BEST閲覧料 未送金件数"
              value={String(pendingBestViewPayoutCount)}
            />
            <SummaryCard
              label="BEST閲覧料 送金済み件数"
              value={String(paidBestViewPayoutCount)}
            />
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">直近の質問</h2>
                <Link href="/questions" className="text-sm text-blue-600 underline">
                  質問一覧を見る
                </Link>
              </div>
              <div className="space-y-3">
                {recentQuestions.map((question) => (
                  <Link
                    key={question.id}
                    href={`/questions/${question.id}`}
                    className="block rounded-lg border border-gray-100 px-4 py-3 hover:bg-gray-50"
                  >
                    <div className="font-semibold text-gray-900">{question.title}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {new Date(question.createdAt).toLocaleString("ja-JP")} /{" "}
                      {question.rewardAmount.toLocaleString("ja-JP")}円 /{" "}
                      {question.bestAnswerId ? "BEST選定済み" : "未選定"} /{" "}
                      {question.isPaid ? "公開中" : "未公開"}
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">直近の回答</h2>
                <Link href="/questions" className="text-sm text-blue-600 underline">
                  質問一覧を見る
                </Link>
              </div>
              <div className="space-y-3">
                {recentAnswers.map((answer) => (
                  <Link
                    key={answer.id}
                    href={`/questions/${answer.questionId}`}
                    className="block rounded-lg border border-gray-100 px-4 py-3 hover:bg-gray-50"
                  >
                    <div className="font-semibold text-gray-900">
                      {answer.user?.username || "匿名ユーザー"}
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm text-gray-700">
                      {answer.content}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {new Date(answer.createdAt).toLocaleString("ja-JP")}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
