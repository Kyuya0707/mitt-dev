import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getPublicUserDisplayName } from "@/lib/public-user-display";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      bio: true,
      experienceCategory: true,
      experienceYears: true,
      deletedAt: true,
      trustScore: true,
      rank: true,
      stripeConnectOnboardingCompleted: true,
      answers: {
        select: {
          id: true,
          _count: {
            select: { likes: true },
          },
        },
      },
    },
  });

  if (!user) {
    notFound();
  }

  const answerIds = user.answers.map((answer) => answer.id);
  const bestCount =
    answerIds.length > 0
      ? await prisma.question.count({
          where: { bestAnswerId: { in: answerIds } },
        })
      : 0;
  const helpfulCount = user.answers.reduce(
    (total, answer) => total + answer._count.likes,
    0
  );
  const nickname = getPublicUserDisplayName(user, user.id);

  return (
    <main className="mx-auto mt-10 max-w-xl rounded-xl border border-gray-200 bg-white p-6 text-black shadow-sm">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <h1 className="text-center text-2xl font-bold">{nickname}</h1>
        {user.stripeConnectOnboardingCompleted && (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
            本人確認済み
          </span>
        )}
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        {user.bio && (
          <div className="rounded-lg bg-gray-50 p-4 sm:col-span-2">
            <dt className="text-sm text-gray-500">自己紹介</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm">{user.bio}</dd>
          </div>
        )}
        {user.experienceCategory && (
          <div className="rounded-lg bg-gray-50 p-4">
            <dt className="text-sm text-gray-500">経験カテゴリ</dt>
            <dd className="mt-1 font-semibold">{user.experienceCategory}</dd>
          </div>
        )}
        {user.experienceYears !== null && (
          <div className="rounded-lg bg-gray-50 p-4">
            <dt className="text-sm text-gray-500">経験年数</dt>
            <dd className="mt-1 font-semibold">{user.experienceYears}年</dd>
          </div>
        )}
        <div className="rounded-lg bg-gray-50 p-4">
          <dt className="text-sm text-gray-500">BEST回答数</dt>
          <dd className="mt-1 text-xl font-bold">{bestCount}</dd>
        </div>
        <div className="rounded-lg bg-gray-50 p-4">
          <dt className="text-sm text-gray-500">参考になった数</dt>
          <dd className="mt-1 text-xl font-bold">{helpfulCount}</dd>
        </div>
        <div className="rounded-lg bg-gray-50 p-4">
          <dt className="text-sm text-gray-500">信頼スコア</dt>
          <dd className="mt-1 text-xl font-bold">{user.trustScore}</dd>
        </div>
        <div className="rounded-lg bg-gray-50 p-4">
          <dt className="text-sm text-gray-500">ランク</dt>
          <dd className="mt-1 text-xl font-bold">{user.rank}</dd>
        </div>
      </dl>
    </main>
  );
}
