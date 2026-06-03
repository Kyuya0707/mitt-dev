import Link from "next/link";
import prisma from "@/lib/prisma";
import { ensurePrismaUser } from "@/lib/ensure-prisma-user";
import { supabaseServer } from "@/lib/supabase-server";

type RewardHistoryItem = {
  id: string;
  typeLabel: string;
  amount: number;
  status: string;
  createdAt: Date;
  transferredAt: Date | null;
  questionId: string | null;
  questionTitle: string;
};

function getStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "未送金";
    case "processing":
      return "処理中";
    case "paid":
      return "送金済み";
    case "failed":
      return "失敗";
    default:
      return status;
  }
}

function formatYen(value: number) {
  return `${value.toLocaleString("ja-JP")}円`;
}

export default async function MyPageRewardsPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl p-6 text-center">
        <p className="mb-4">ログインが必要です。</p>
        <Link
          href="/login?redirectTo=/mypage/rewards"
          className="text-blue-600 underline"
        >
          ログインページへ
        </Link>
      </div>
    );
  }

  const meta = (user.user_metadata ?? {}) as {
    full_name?: string;
    username?: string;
    interests?: string[];
  };

  try {
    await ensurePrismaUser({
      id: user.id,
      email: user.email,
      username: meta.username,
      name: meta.full_name,
      interests: Array.isArray(meta.interests) ? meta.interests : [],
    });
  } catch (syncError) {
    console.error("Failed to ensure Prisma user on rewards page:", syncError);
  }

  const [questionRewardPayouts, bestViewPayouts] = await Promise.all([
    prisma.payout.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kind: true,
        description: true,
        amount: true,
        status: true,
        questionId: true,
        answerId: true,
        createdAt: true,
        transferredAt: true,
        question: {
          select: {
            title: true,
          },
        },
      },
    }),
    prisma.bestViewPayout.findMany({
      where: { recipientUserId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        recipientType: true,
        status: true,
        createdAt: true,
        transferredAt: true,
        revenueShare: {
          select: {
            questionId: true,
            answerId: true,
          },
        },
      },
    }),
  ]);

  const questionIds = Array.from(
    new Set(
      [
        ...questionRewardPayouts.map((payout) => payout.questionId),
        ...bestViewPayouts.map((payout) => payout.revenueShare.questionId),
      ].filter((questionId): questionId is string => Boolean(questionId))
    )
  );

  const questions = questionIds.length
    ? await prisma.question.findMany({
        where: {
          id: { in: questionIds },
        },
        select: {
          id: true,
          title: true,
        },
      })
    : [];

  const questionTitleMap = new Map(
    questions.map((question) => [question.id, question.title])
  );

  const history: RewardHistoryItem[] = [
    ...questionRewardPayouts.map((payout) => ({
      id: payout.id,
      typeLabel:
        payout.kind === "negotiation_reward"
          ? "交渉追加報酬"
          : "質問報酬",
      amount: payout.amount,
      status: payout.status,
      createdAt: payout.createdAt,
      transferredAt: payout.transferredAt,
      questionId: payout.questionId,
      questionTitle:
        (payout.questionId
          ? questionTitleMap.get(payout.questionId)
          : payout.question?.title) ?? "（削除された質問）",
    })),
    ...bestViewPayouts.map((payout) => ({
      id: payout.id,
      typeLabel:
        payout.recipientType === "question_owner"
          ? "BEST閲覧料（質問者分）"
          : "BEST閲覧料（旧仕様）",
      amount: payout.amount,
      status: payout.status,
      createdAt: payout.createdAt,
      transferredAt: payout.transferredAt,
      questionId: payout.revenueShare.questionId,
      questionTitle:
        questionTitleMap.get(payout.revenueShare.questionId) ??
        "（削除された質問）",
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const totalAmount = history.reduce((sum, item) => sum + item.amount, 0);
  const paidAmount = history
    .filter((item) => item.status === "paid")
    .reduce((sum, item) => sum + item.amount, 0);
  const unpaidAmount = history
    .filter((item) => item.status !== "paid")
    .reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="mx-auto max-w-5xl p-6 text-black">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">報酬確認</h1>
          <p className="mt-2 text-sm text-gray-600">
            質問報酬・交渉追加報酬・BEST閲覧料の受取状況を確認できます。
          </p>
        </div>
        <Link href="/mypage" className="text-sm text-blue-600 underline">
          ← マイページへ戻る
        </Link>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">合計報酬</p>
          <p className="mt-2 text-2xl font-bold">{formatYen(totalAmount)}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">未送金額</p>
          <p className="mt-2 text-2xl font-bold">{formatYen(unpaidAmount)}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">送金済み額</p>
          <p className="mt-2 text-2xl font-bold">{formatYen(paidAmount)}</p>
        </div>
      </div>

      <section className="rounded border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">報酬履歴</h2>

        {history.length === 0 ? (
          <p className="text-sm text-gray-500">まだ報酬履歴はありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="px-3 py-2 font-medium">種別</th>
                  <th className="px-3 py-2 font-medium">金額</th>
                  <th className="px-3 py-2 font-medium">ステータス</th>
                  <th className="px-3 py-2 font-medium">発生日</th>
                  <th className="px-3 py-2 font-medium">送金日</th>
                  <th className="px-3 py-2 font-medium">関連質問</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} className="border-b last:border-b-0">
                    <td className="px-3 py-3">{item.typeLabel}</td>
                    <td className="px-3 py-3">{formatYen(item.amount)}</td>
                    <td className="px-3 py-3">{getStatusLabel(item.status)}</td>
                    <td className="px-3 py-3">
                      {item.createdAt.toLocaleString("ja-JP")}
                    </td>
                    <td className="px-3 py-3">
                      {item.transferredAt
                        ? item.transferredAt.toLocaleString("ja-JP")
                        : "-"}
                    </td>
                    <td className="px-3 py-3">
                      {item.questionId ? (
                        <Link
                          href={`/questions/${item.questionId}`}
                          className="text-blue-600 underline"
                        >
                          {item.questionTitle}
                        </Link>
                      ) : (
                        "（関連質問なし）"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
