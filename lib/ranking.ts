import "server-only";

import prisma from "@/lib/prisma";

export type RankingRange = "week" | "month" | "all";

export type RankingRow = {
  rank: number;
  userId: string;
  displayName: string;
  trustScore: number;
  trustRank: string;
  bestCount: number;
};

function getFromDate(range: RankingRange) {
  if (range === "all") {
    return null;
  }

  const result = new Date();
  result.setDate(result.getDate() - (range === "week" ? 7 : 30));
  return result;
}

export function normalizeRankingRange(value: unknown): RankingRange {
  return value === "month" || value === "all" ? value : "week";
}

export async function getRankingRows(range: RankingRange) {
  const from = getFromDate(range);
  const grouped = await prisma.payout.groupBy({
    by: ["userId"],
    where: {
      kind: "question_reward",
      answerId: { not: null },
      ...(from ? { createdAt: { gte: from } } : {}),
    },
    _count: { _all: true },
  });

  const sorted = grouped
    .map((item) => ({
      userId: item.userId,
      bestCount: item._count._all,
    }))
    .sort(
      (a, b) =>
        b.bestCount - a.bestCount || a.userId.localeCompare(b.userId)
    )
    .slice(0, 50);

  if (sorted.length === 0) {
    return [] satisfies RankingRow[];
  }

  const users = await prisma.user.findMany({
    where: { id: { in: sorted.map((item) => item.userId) } },
    select: {
      id: true,
      username: true,
      trustScore: true,
      rank: true,
    },
  });
  const userMap = new Map(users.map((user) => [user.id, user]));

  return sorted.map((item, index): RankingRow => {
    const user = userMap.get(item.userId);
    return {
      rank: index + 1,
      userId: item.userId,
      displayName: user?.username ?? "退会済みユーザー",
      trustScore: user?.trustScore ?? 0,
      trustRank: user?.rank ?? "Bronze",
      bestCount: item.bestCount,
    };
  });
}
